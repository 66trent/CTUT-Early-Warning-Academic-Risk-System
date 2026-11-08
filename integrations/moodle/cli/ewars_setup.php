<?php
// CTUT-EWARS — cấu hình web service CHỈ ĐỌC trên Moodle demo (Phase 10a, docs/tich-hop-moodle.md mục 2, 6).
// Chạy trong container: php /var/www/html/ewars-cli/ewars_setup.php [--rotate] [--events-url=<url> < khóa]
// Idempotent: chạy lại không tạo trùng. Dòng cuối in `TOKEN=<token>` cho scripts/moodle-setup.ts.
//
// Tài khoản dịch vụ `ewars_sync` có vai trò hệ thống `ewarssync`. Một số hàm đọc của Moodle đòi quyền
// rộng hơn đọc (VD `mod_attendance_get_sessions` cần `mod/attendance:takeattendances`,
// `mod_assign_get_user_flags` cần `mod/assign:grade`) — token vẫn CHỈ gọi được các hàm loại `read`
// liệt kê ở EWARS_FUNCTIONS vì external service bị giới hạn hàm.

define('CLI_SCRIPT', true);

require('/var/www/html/config.php');
require_once($CFG->libdir . '/clilib.php');
require_once($CFG->dirroot . '/user/lib.php');
require_once($CFG->dirroot . '/webservice/lib.php');

[$options] = cli_get_params(['rotate' => false, 'events-url' => '', 'help' => false], ['h' => 'help']);
if ($options['help']) {
    echo "Cấu hình web service chỉ đọc cho EWARS. --rotate: tạo token mới (thu hồi token cũ).\n";
    exit(0);
}

const EWARS_SERVICE = 'ewars_readonly';
const EWARS_USER = 'ewars_sync';
const EWARS_ROLE = 'ewarssync';

/** Hàm web service EWARS được gọi — CHỈ loại `read` (kiểm ở dưới). */
const EWARS_FUNCTIONS = [
    'core_webservice_get_site_info',
    'core_course_get_courses_by_field',
    'core_course_get_contents',
    'core_enrol_get_enrolled_users',
    'mod_quiz_get_quizzes_by_courses',
    'mod_quiz_get_user_quiz_attempts',
    'gradereport_user_get_grade_items',
    'mod_assign_get_assignments',
    'mod_assign_get_submissions',
    'mod_assign_get_user_flags',
    'mod_attendance_get_sessions',
];

/** Quyền tối thiểu để các hàm trên trả dữ liệu mọi sinh viên của mọi khóa học. */
const EWARS_CAPABILITIES = [
    'webservice/rest:use',
    'moodle/course:view',
    'moodle/course:viewhiddencourses',
    // Moodle chỉ trả Course ID number (= mã lớp học phần) trong core_course_get_courses_by_field cho
    // người có quyền này (phát hiện ở Phase 10b). Token vẫn chỉ gọi được các hàm loại read ở trên.
    'moodle/course:update',
    'moodle/course:viewparticipants',
    'moodle/course:enrolreview',
    'moodle/user:viewdetails',
    'moodle/site:viewuseridentity',
    'moodle/site:accessallgroups',
    'moodle/grade:viewall',
    'gradereport/user:view',
    'mod/quiz:view',
    'mod/quiz:viewreports',
    'mod/assign:view',
    'mod/assign:viewgrades',
    'mod/assign:grade',
    'mod/attendance:view',
    'mod/attendance:takeattendances',
];

\core\session\manager::set_user(get_admin());
$syscontext = context_system::instance();

// 1. Bật web service + REST; cho thấy ID number (= MSSV) và email ở danh sách thành viên.
set_config('enablewebservices', 1);
$protocols = array_filter(explode(',', (string) get_config('core', 'webserviceprotocols')));
if (!in_array('rest', $protocols, true)) {
    $protocols[] = 'rest';
    set_config('webserviceprotocols', implode(',', $protocols));
}
set_config('showuseridentity', 'idnumber,email');

// 2. Tài khoản dịch vụ (không đăng nhập giao diện — mật khẩu ngẫu nhiên, không lưu).
$user = $DB->get_record('user', ['username' => EWARS_USER, 'deleted' => 0]);
if (!$user) {
    $userid = user_create_user((object) [
        'username' => EWARS_USER,
        'auth' => 'manual',
        'password' => random_string(32) . 'Aa1!',
        'firstname' => 'EWARS',
        'lastname' => 'Đồng bộ',
        'email' => 'ewars-sync@moodle.local',
        'confirmed' => 1,
        'mnethostid' => $CFG->mnet_localhost_id,
    ], true, false);
    $user = $DB->get_record('user', ['id' => $userid], '*', MUST_EXIST);
    cli_writeln("+ tài khoản dịch vụ " . EWARS_USER);
}

// 3. Vai trò hệ thống với đúng các quyền cần.
$roleid = $DB->get_field('role', 'id', ['shortname' => EWARS_ROLE]);
if (!$roleid) {
    $roleid = create_role('EWARS đồng bộ (chỉ đọc)', EWARS_ROLE,
        'Tài khoản dịch vụ của CTUT-EWARS đọc điểm danh, trắc nghiệm, bài nộp.', '');
    set_role_contextlevels($roleid, [CONTEXT_SYSTEM]);
    cli_writeln('+ vai trò ' . EWARS_ROLE);
}
foreach (EWARS_CAPABILITIES as $cap) {
    if (!get_capability_info($cap)) {
        cli_error("Moodle không có quyền {$cap} (thiếu plugin?)");
    }
    assign_capability($cap, CAP_ALLOW, $roleid, $syscontext->id, true);
}
if (!user_has_role_assignment($user->id, $roleid, $syscontext->id)) {
    role_assign($roleid, $user->id, $syscontext->id);
}

// 4. External service giới hạn hàm + chỉ người dùng được phép.
$ws = new webservice();
$service = $ws->get_external_service_by_shortname(EWARS_SERVICE);
if (!$service) {
    $serviceid = $ws->add_external_service((object) [
        'name' => 'CTUT-EWARS (chỉ đọc)',
        'shortname' => EWARS_SERVICE,
        'enabled' => 1,
        'restrictedusers' => 1,
        'downloadfiles' => 0,
        'uploadfiles' => 0,
    ]);
    $service = $DB->get_record('external_services', ['id' => $serviceid], '*', MUST_EXIST);
    cli_writeln('+ external service ' . EWARS_SERVICE);
}
foreach (EWARS_FUNCTIONS as $fn) {
    $info = $DB->get_record('external_functions', ['name' => $fn]);
    if (!$info) {
        cli_error("Moodle không có hàm {$fn}");
    }
    $type = \core_external\external_api::external_function_info($fn)->type;
    if ($type !== 'read') {
        cli_error("Hàm {$fn} không phải loại read ({$type}) — EWARS chỉ được đọc");
    }
    if (!$ws->service_function_exists($fn, $service->id)) {
        $ws->add_external_function_to_service($fn, $service->id);
    }
}
if (!$DB->record_exists('external_services_users', ['externalserviceid' => $service->id, 'userid' => $user->id])) {
    $ws->add_ws_authorised_user((object) [
        'externalserviceid' => $service->id,
        'userid' => $user->id,
    ]);
}

// 5. Token vĩnh viễn (dùng lại nếu đã có, --rotate thì thu hồi và tạo mới).
$conditions = ['externalserviceid' => $service->id, 'userid' => $user->id, 'tokentype' => EXTERNAL_TOKEN_PERMANENT];
if ($options['rotate']) {
    $DB->delete_records('external_tokens', $conditions);
}
$token = $DB->get_field('external_tokens', 'token', $conditions, IGNORE_MULTIPLE);
if (!$token) {
    $token = \core_external\util::generate_token(EXTERNAL_TOKEN_PERMANENT, $service, $user->id, $syscontext, 0, '', 'EWARS');
    cli_writeln('+ token mới');
}

// 6. Plugin local_ewars (Phase 10c): URL nhận sự kiện + khóa bí mật (đọc từ STDIN — không đặt trên
// dòng lệnh). Moodle mặc định chặn cURL tới địa chỉ nội bộ và cổng lạ → CHỈ bản demo: bỏ chặn dải
// mạng riêng (Docker) và cho cổng của EWARS. Chạy thật qua HTTPS 443 tên miền công khai không cần.
if ($options['events-url']) {
    if (!core_plugin_manager::instance()->get_plugin_info('local_ewars')) {
        cli_error('Chưa cài plugin local_ewars — khởi động lại container moodle (npm run moodle:up).');
    }
    $secret = trim((string) fgets(STDIN));
    if (strlen($secret) < 32) {
        cli_error('Khóa bí mật (STDIN) phải ≥ 32 ký tự.');
    }
    set_config('eventsurl', $options['events-url'], 'local_ewars');
    set_config('secret', $secret, 'local_ewars');
    $blocked = preg_split('/\R/', (string) get_config('core', 'curlsecurityblockedhosts'), -1, PREG_SPLIT_NO_EMPTY);
    $private = ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'];
    set_config('curlsecurityblockedhosts', implode("\n", array_values(array_diff(array_map('trim', $blocked), $private))));
    $port = (string) (parse_url($options['events-url'], PHP_URL_PORT) ?: '');
    $ports = preg_split('/\R/', (string) get_config('core', 'curlsecurityallowedport'), -1, PREG_SPLIT_NO_EMPTY);
    if ($port !== '' && $ports && !in_array($port, array_map('trim', $ports), true)) {
        $ports[] = $port;
        set_config('curlsecurityallowedport', implode("\n", $ports));
    }
    cli_writeln('OK: plugin local_ewars gửi sự kiện tới ' . $options['events-url']);
}

cli_writeln('OK: web service chỉ đọc, ' . count(EWARS_FUNCTIONS) . ' hàm, tài khoản ' . EWARS_USER);
echo 'TOKEN=' . $token . PHP_EOL;
