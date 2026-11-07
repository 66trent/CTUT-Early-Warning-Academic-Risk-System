<?php
// CTUT-EWARS — dựng dữ liệu Moodle demo từ docs/demo-data/moodle/moodle-demo.json (Phase 10a).
// Chạy trong container (do scripts/moodle-setup.ts gọi):
//   MOODLE_DEMO_PASSWORD=... php /var/www/html/ewars-cli/ewars_seed_demo.php [--accounts-only]
// --accounts-only: chỉ tạo tài khoản giảng viên + sinh viên (để người dùng TỰ tạo khóa học, bài,
// buổi điểm danh trên giao diện — docs/huong-dan-moodle.md).
// Idempotent: tài khoản / danh mục có rồi thì dùng lại; khóa học có Course ID number trùng thì BỎ QUA
// (muốn dựng lại: xóa khóa học trên Moodle hoặc chạy lại với --reset).
// Dùng bộ sinh dữ liệu thử của Moodle (testing_data_generator — giống công cụ tool_generator), rồi
// đặt lại thời điểm (làm bài, nộp bài, điểm danh) theo đúng lịch trong file JSON.

define('CLI_SCRIPT', true);

require('/var/www/html/config.php');
require_once($CFG->libdir . '/clilib.php');
require_once($CFG->libdir . '/testing/generator/lib.php');
require_once($CFG->dirroot . '/course/lib.php');
require_once($CFG->dirroot . '/mod/quiz/locallib.php');
require_once($CFG->dirroot . '/mod/assign/locallib.php');

[$options] = cli_get_params(
    ['spec' => '/var/www/html/ewars-demo/moodle-demo.json', 'accounts-only' => false, 'reset' => false, 'help' => false],
    ['h' => 'help']
);
if ($options['help']) {
    echo "Dựng dữ liệu Moodle demo cho EWARS. --accounts-only: chỉ tạo tài khoản.\n";
    exit(0);
}
$password = getenv('MOODLE_DEMO_PASSWORD');
if (!$password) {
    cli_error('Thiếu biến môi trường MOODLE_DEMO_PASSWORD (mật khẩu chung tài khoản demo).');
}
$spec = json_decode(file_get_contents($options['spec']), false, 512, JSON_THROW_ON_ERROR);

\core\session\manager::set_user(get_admin());
$generator = new testing_data_generator();
// Không gửi email chào mừng khi ghi danh (Moodle demo không có máy chủ thư).
set_config('sendcoursewelcomemessage', 0, 'enrol_manual');
set_exception_handler(function (Throwable $e): void {
    fwrite(STDERR, 'LỖI: ' . $e->getMessage() . PHP_EOL . $e->getTraceAsString() . PHP_EOL);
    exit(1);
});

/** ISO 8601 có múi giờ (+07:00) → Unix timestamp. */
function ewars_ts(string $iso): int {
    return (new DateTimeImmutable($iso))->getTimestamp();
}

/** Tạo tài khoản nếu chưa có (theo username); trả id. */
function ewars_ensure_user(testing_data_generator $generator, stdClass $u, string $idnumber, string $password): int {
    global $DB, $CFG;
    $existing = $DB->get_record('user', ['username' => $u->username, 'mnethostid' => $CFG->mnet_localhost_id]);
    if ($existing) {
        return (int) $existing->id;
    }
    return (int) $generator->create_user([
        'username' => $u->username,
        'password' => $password,
        'auth' => 'manual',
        'firstname' => $u->firstname,
        'lastname' => $u->lastname,
        'email' => $u->email,
        'idnumber' => $idnumber,
        'lang' => 'en',
        'timezone' => 'Asia/Ho_Chi_Minh',
    ])->id;
}

// ── Tài khoản ──────────────────────────────────────────────────────────────
$teacherid = ewars_ensure_user($generator, $spec->teacher, '', $password);
$studentids = [];
foreach ($spec->students as $s) {
    $studentids[$s->mssv] = ewars_ensure_user($generator, $s, $s->mssv, $password);
}
cli_writeln('Tài khoản: 1 giảng viên (' . $spec->teacher->username . '), ' . count($studentids) . ' sinh viên');
if ($options['accounts-only']) {
    cli_writeln('OK (chỉ tài khoản).');
    exit(0);
}

// ── Danh mục học kỳ ────────────────────────────────────────────────────────
$categoryid = $DB->get_field('course_categories', 'id', ['idnumber' => $spec->term->termId]);
if (!$categoryid) {
    $categoryid = core_course_category::create(['name' => $spec->category, 'idnumber' => $spec->term->termId])->id;
}

foreach ($spec->courses as $c) {
    $existingid = $DB->get_field('course', 'id', ['idnumber' => $c->idnumber]);
    if ($existingid && $options['reset']) {
        delete_course($existingid, false);
        cli_writeln("- xóa khóa học {$c->idnumber} cũ");
        $existingid = false;
    }
    if ($existingid) {
        cli_writeln("= {$c->idnumber} đã có trên Moodle — bỏ qua");
        continue;
    }
    $course = $generator->create_course([
        'fullname' => $c->fullname,
        'shortname' => $c->shortname,
        'idnumber' => $c->idnumber,
        'category' => $categoryid,
        'startdate' => ewars_ts($spec->term->startDate . 'T00:00:00+07:00'),
        'enddate' => ewars_ts($spec->term->endDate . 'T23:59:00+07:00'),
        'format' => 'topics',
        'numsections' => 3,
    ]);
    $generator->enrol_user($teacherid, $course->id, 'editingteacher');
    foreach ($studentids as $uid) {
        $generator->enrol_user($uid, $course->id, 'student');
    }
    ewars_seed_attendance($generator, $course, $c->attendance, $studentids, $teacherid);
    $quizcount = ewars_seed_quizzes($generator, $course, $c->quizzes, $studentids);
    ewars_seed_assignments($generator, $course, $c->assignments, $studentids);
    cli_writeln("+ {$c->idnumber} {$c->fullname}: " . count($c->attendance->sessions) . ' buổi, '
        . count($c->quizzes) . " trắc nghiệm ({$quizcount} lượt), " . count($c->assignments) . ' thực hành');
}

// Bộ nhớ đệm khóa học / điểm phải xóa sau khi sửa thẳng DB.
purge_all_caches();
cli_writeln('OK');

// ── Điểm danh (mod_attendance) ─────────────────────────────────────────────
function ewars_seed_attendance(testing_data_generator $generator, stdClass $course, stdClass $att, array $studentids, int $teacherid): void {
    global $DB;
    $instance = $generator->create_module('attendance', ['course' => $course->id, 'name' => $att->name, 'grade' => 0]);
    $statuses = $DB->get_records_menu('attendance_statuses',
        ['attendanceid' => $instance->id, 'deleted' => 0, 'setnumber' => 0], '', 'acronym, id');
    foreach (['P', 'L', 'E', 'A'] as $acronym) {
        if (!isset($statuses[$acronym])) {
            throw new moodle_exception('Thiếu trạng thái điểm danh ' . $acronym);
        }
    }
    $statusset = implode(',', $statuses);
    foreach ($att->sessions as $sess) {
        $start = ewars_ts($sess->start);
        $sessionid = $DB->insert_record('attendance_sessions', (object) [
            'attendanceid' => $instance->id,
            'groupid' => 0,
            'sessdate' => $start,
            'duration' => $sess->durationMinutes * 60,
            'lasttaken' => $sess->taken ? $start + $sess->durationMinutes * 60 : null,
            'lasttakenby' => $sess->taken ? $teacherid : 0,
            'timemodified' => $start,
            'description' => 'Buổi học',
            'descriptionformat' => FORMAT_HTML,
            'calendarevent' => 0,
            'statusset' => 0,
        ]);
        if (!$sess->taken) {
            continue;
        }
        foreach ((array) $sess->statuses as $mssv => $acronym) {
            $DB->insert_record('attendance_log', (object) [
                'sessionid' => $sessionid,
                'studentid' => $studentids[$mssv],
                'statusid' => $statuses[$acronym],
                'statusset' => $statusset,
                'timetaken' => $start + $sess->durationMinutes * 60,
                'takenby' => $teacherid,
                'remarks' => '',
            ]);
        }
    }
}

/**
 * 1 câu Đúng/Sai (đáp án Đúng, 1 điểm) qua API lưu câu hỏi của Moodle — giống form soạn câu hỏi.
 * (Không dùng core_question_generator::create_question vì nó nạp helper của PHPUnit.)
 */
function ewars_create_truefalse(stdClass $category, string $name): stdClass {
    global $USER;
    $html = fn(string $text) => ['text' => $text, 'format' => FORMAT_HTML];
    $question = (object) [
        'qtype' => 'truefalse',
        'category' => $category->id,
        'createdby' => $USER->id,
        'idnumber' => null,
        'status' => \core_question\local\bank\question_version_status::QUESTION_STATUS_READY,
    ];
    $form = (object) [
        'category' => $category->id . ',' . $category->contextid,
        'name' => $name,
        'questiontext' => $html("{$name}: phát biểu này đúng."),
        'generalfeedback' => $html(''),
        'defaultmark' => 1,
        'penalty' => 1,
        'correctanswer' => '1',
        'feedbacktrue' => $html(''),
        'feedbackfalse' => $html(''),
        'showstandardinstruction' => 0,
        'status' => \core_question\local\bank\question_version_status::QUESTION_STATUS_READY,
    ];
    return question_bank::get_qtype('truefalse')->save_question($question, $form);
}

/**
 * Trả lời đúng `$correct` câu đầu (Đúng), sai các câu còn lại, rồi nộp + chấm — qua API quiz_attempt
 * (mod_quiz_generator::submit_responses chỉ chạy trong unit test).
 */
function ewars_submit_attempt(int $attemptid, int $correct, int $finish): void {
    $attemptobj = \mod_quiz\quiz_attempt::create($attemptid);
    $postdata = [];
    foreach ($attemptobj->get_slots() as $slot) {
        $qa = $attemptobj->get_question_attempt($slot);
        $postdata[$qa->get_control_field_name('sequencecheck')] = (string) $qa->get_sequence_check_count();
        $postdata[$qa->get_flag_field_name()] = '0';
        $summary = get_string($slot <= $correct ? 'true' : 'false', 'qtype_truefalse');
        foreach ($qa->get_question()->un_summarise_response($summary) as $name => $value) {
            $postdata[$qa->get_qt_field_name($name)] = (string) $value;
        }
    }
    $attemptobj->process_submitted_actions($finish, false, $postdata);
    $attemptobj->process_submit($finish, false);
    $attemptobj->process_grade_submission($finish);
}

// ── Bài trắc nghiệm (10 câu Đúng/Sai, 1 điểm/câu, thang 10) ─────────────────
function ewars_seed_quizzes(testing_data_generator $generator, stdClass $course, array $quizzes, array $studentids): int {
    global $DB;
    $quizgen = $generator->get_plugin_generator('mod_quiz');
    $qgen = $generator->get_plugin_generator('core_question');
    $category = $qgen->create_question_category(['contextid' => context_course::instance($course->id)->id]);
    $count = 0;
    foreach ($quizzes as $q) {
        $quiz = $quizgen->create_instance([
            'course' => $course->id,
            'name' => $q->name,
            'timeopen' => ewars_ts($q->open),
            'duedate' => ewars_ts($q->due),
            'grade' => 10,
            'sumgrades' => $q->questions,
            'attempts' => 0,
            'grademethod' => QUIZ_GRADEHIGHEST,
            'preferredbehaviour' => 'deferredfeedback',
        ]);
        for ($i = 1; $i <= $q->questions; $i++) {
            $question = ewars_create_truefalse($category, "{$q->key} câu {$i}");
            quiz_add_quiz_question($question->id, $quiz, 1);
        }
        foreach ($q->attempts as $a) {
            $userid = $studentids[$a->mssv];
            // Không dùng mod_quiz_generator::create_attempt: nó tạo lượt cho $USER (admin → lượt "xem trước").
            $previous = quiz_get_user_attempts($quiz->id, $userid, 'all', true);
            $last = $previous ? end($previous) : null;
            $attempt = quiz_prepare_and_start_new_attempt(
                \mod_quiz\quiz_settings::create($quiz->id, $userid),
                $last ? $last->attempt + 1 : 1, $last ?: null, false, [], [], $userid
            );
            $start = ewars_ts($a->start);
            if ($a->finish !== null) {
                $finish = ewars_ts($a->finish);
                ewars_submit_attempt((int) $attempt->id, (int) $a->correct, $finish);
                $DB->update_record('quiz_attempts', (object) [
                    'id' => $attempt->id, 'timestart' => $start, 'timefinish' => $finish, 'timemodified' => $finish,
                ]);
                $DB->set_field('quiz_grades', 'timemodified', $finish, ['quiz' => $quiz->id, 'userid' => $userid]);
            } else {
                $DB->update_record('quiz_attempts', (object) [
                    'id' => $attempt->id, 'timestart' => $start, 'timemodified' => $start,
                ]);
            }
            $count++;
        }
    }
    return $count;
}

// ── Bài thực hành (nộp văn bản trực tuyến; nộp ngay = "submitted", không có bản nháp) ──
function ewars_seed_assignments(testing_data_generator $generator, stdClass $course, array $assignments, array $studentids): void {
    global $DB;
    $assigngen = $generator->get_plugin_generator('mod_assign');
    foreach ($assignments as $a) {
        $instance = $assigngen->create_instance([
            'course' => $course->id,
            'name' => $a->name,
            'allowsubmissionsfromdate' => ewars_ts($a->open),
            'duedate' => ewars_ts($a->due),
            'cutoffdate' => 0,
            'gradingduedate' => 0,
            'grade' => 10,
            'submissiondrafts' => 0,
            'assignsubmission_onlinetext_enabled' => 1,
            'assignsubmission_file_enabled' => 0,
        ]);
        foreach ($a->submissions as $sub) {
            $userid = $studentids[$sub->mssv];
            $assigngen->create_submission([
                'userid' => $userid,
                'cmid' => $instance->cmid,
                'onlinetext' => "Bài làm {$a->key} của {$sub->mssv}",
                'status' => ASSIGN_SUBMISSION_STATUS_SUBMITTED,
            ]);
            $at = ewars_ts($sub->submittedAt);
            $DB->execute(
                'UPDATE {assign_submission} SET timecreated = ?, timemodified = ?, timestarted = ?
                  WHERE assignment = ? AND userid = ? AND latest = 1',
                [$at, $at, $at, $instance->id, $userid]
            );
        }
        foreach ($a->extensions as $ext) {
            $assigngen->create_extension([
                'cmid' => $instance->cmid,
                'userid' => $studentids[$ext->mssv],
                'extensionduedate' => ewars_ts($ext->until),
            ]);
        }
    }
}
