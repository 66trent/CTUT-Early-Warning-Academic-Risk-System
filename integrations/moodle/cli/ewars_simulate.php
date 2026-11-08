<?php
// CTUT-EWARS — mô phỏng thao tác của giảng viên trên Moodle demo (Phase 10c) để thử / trình diễn chế độ
// Tự động mà không cần mở giao diện Moodle. Đi qua ĐÚNG mã của Moodle → phát sự kiện thật → plugin
// local_ewars gửi sang EWARS ở lần cron kế tiếp (≤ 1 phút).
// Chạy trong container:
//   php ewars_simulate.php --course=010100089201 --absent=KTPM2411905 [--status=A]
//       Điểm danh sinh viên ở buổi đã điểm danh gần nhất (mặc định A = vắng không phép).
//   php ewars_simulate.php --course=010100089201 --due-in=3 [--assign="Bài thực hành 3"]
//       Đổi hạn nộp 1 bài thực hành thành "N phút nữa" (như giảng viên sửa hạn) — để thử job hạn nộp.

define('CLI_SCRIPT', true);

require('/var/www/html/config.php');
require_once($CFG->libdir . '/clilib.php');
// Nạp sẵn ở phạm vi toàn cục: các file này dùng $CFG mà không khai báo global — nạp trong hàm
// (update_user_status::execute) sẽ hỏng đường dẫn.
require_once($CFG->dirroot . '/mod/attendance/lib.php');
require_once($CFG->dirroot . '/mod/attendance/locallib.php');
require_once($CFG->dirroot . '/mod/attendance/classes/structure.php');

[$options] = cli_get_params(
    ['course' => '', 'absent' => '', 'status' => 'A', 'due-in' => '', 'assign' => '', 'help' => false],
    ['h' => 'help']
);
if ($options['help'] || $options['course'] === '') {
    echo "Dùng: --course=<Course ID number> (--absent=<MSSV> [--status=A] | --due-in=<phút> [--assign=<tên>])\n";
    exit($options['help'] ? 0 : 1);
}

\core\session\manager::set_user(get_admin());
$course = $DB->get_record('course', ['idnumber' => $options['course']], '*', MUST_EXIST);

if ($options['absent'] !== '') {
    $user = $DB->get_record('user', ['idnumber' => $options['absent'], 'deleted' => 0], '*', MUST_EXIST);
    $attendance = $DB->get_record('attendance', ['course' => $course->id], '*', MUST_EXIST);
    $sessions = $DB->get_records_select(
        'attendance_sessions',
        'attendanceid = ? AND lasttaken > 0 AND sessdate <= ?',
        [$attendance->id, time()],
        'sessdate DESC',
        '*',
        0,
        1
    );
    $session = reset($sessions);
    if (!$session) {
        cli_error('Khóa học chưa có buổi nào đã điểm danh.');
    }
    $status = $DB->get_record('attendance_statuses', [
        'attendanceid' => $attendance->id,
        'setnumber' => $session->statusset,
        'acronym' => $options['status'],
        'deleted' => 0,
    ], '*', MUST_EXIST);
    // Đúng đường của màn "Điểm danh" trên giao diện (take_from_form_data → save_log → sự kiện
    // attendance_taken). KHÔNG dùng web service update_user_status: hàm đó ghi thẳng bảng, không phát
    // sự kiện (phát hiện Phase 10c) — điểm danh qua app di động chỉ được lịch dò 10 phút bắt.
    $cm = get_coursemodule_from_instance('attendance', $attendance->id, $course->id, false, MUST_EXIST);
    $pageparams = new mod_attendance_take_page_params();
    $pageparams->sessionid = (int) $session->id;
    $pageparams->grouptype = (int) $session->groupid;
    $att = new mod_attendance_structure($attendance, $cm, $course, context_module::instance($cm->id), $pageparams);
    $existing = $DB->get_record('attendance_log', ['sessionid' => $session->id, 'studentid' => $user->id]);
    $att->take_from_form_data((object) [
        'user' . $user->id => $status->id,
        'remarks' . $user->id => $existing->remarks ?? '',
    ]);
    cli_writeln(sprintf(
        'OK: %s = %s ở buổi %s (%s)',
        $options['absent'],
        $options['status'],
        userdate($session->sessdate, '%d/%m/%Y %H:%M'),
        $course->fullname
    ));
}

if ($options['due-in'] !== '') {
    $minutes = (int) $options['due-in'];
    if ($minutes < 1 || $minutes > 1440) {
        cli_error('--due-in phải từ 1 đến 1440 phút.');
    }
    $assigns = $DB->get_records('assign', ['course' => $course->id], 'duedate ASC');
    $assign = null;
    foreach ($assigns as $a) {
        if ($options['assign'] === '' || stripos($a->name, $options['assign']) !== false) {
            $assign = $a;
            break;
        }
    }
    if (!$assign) {
        cli_error('Không tìm thấy bài thực hành.');
    }
    // Hạn tròn phút để dễ theo dõi; mốc cắt (nếu có) dời theo để vẫn nộp được tới hạn mới.
    $due = (int) (ceil((time() + $minutes * 60) / 60) * 60);
    $DB->update_record('assign', (object) [
        'id' => $assign->id,
        'duedate' => $due,
        'cutoffdate' => $assign->cutoffdate ? $due + 7 * DAYSECS : 0,
        'timemodified' => time(),
    ]);
    $cm = get_coursemodule_from_instance('assign', $assign->id, $course->id, false, MUST_EXIST);
    rebuild_course_cache($course->id, true);
    \core\event\course_module_updated::create_from_cm($cm)->trigger();
    cli_writeln(sprintf('OK: hạn nộp "%s" = %s', $assign->name, userdate($due, '%d/%m/%Y %H:%M')));
}
