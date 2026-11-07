<?php
// Cấu hình Moodle demo của CTUT-EWARS (Phase 10a) — đọc từ biến môi trường của container.
// CHỈ dùng cho phát triển / trình diễn: http, không bật bảo mật triển khai thật.
unset($CFG);
global $CFG;
$CFG = new stdClass();

$CFG->dbtype    = 'pgsql';
$CFG->dblibrary = 'native';
$CFG->dbhost    = getenv('MOODLE_DB_HOST') ?: 'moodle-db';
$CFG->dbname    = getenv('MOODLE_DB_NAME') ?: 'moodle';
$CFG->dbuser    = getenv('MOODLE_DB_USER') ?: 'moodle';
$CFG->dbpass    = getenv('MOODLE_DB_PASSWORD') ?: '';
$CFG->prefix    = 'mdl_';
$CFG->dboptions = ['dbpersist' => false, 'dbport' => 5432];

// Cùng 1 Moodle được gọi bằng nhiều tên: trình duyệt (localhost:8080), container app/worker
// của EWARS (moodle), worker chạy ở máy (localhost:8080). Moodle từ chối tên máy lệch wwwroot,
// nên wwwroot lấy theo Host — CHỈ trong danh sách cho phép (chống giả mạo Host header).
$allowedhosts = ['localhost:8080', '127.0.0.1:8080', 'moodle', 'moodle:80', 'host.docker.internal:8080'];
$requesthost = $_SERVER['HTTP_HOST'] ?? '';
$CFG->wwwroot = in_array($requesthost, $allowedhosts, true)
    ? 'http://' . $requesthost
    : (getenv('MOODLE_WWWROOT') ?: 'http://localhost:8080');

$CFG->dataroot  = '/var/www/moodledata';
$CFG->admin     = 'admin';
$CFG->directorypermissions = 02777;
// Moodle demo không gửi email thật (EWARS dùng MailHog riêng).
$CFG->noemailever = true;

// Cho phép Moodle gọi ra EWARS ở mạng nội bộ Docker / máy (plugin local_ewars, Phase 10c).
$CFG->curlsecurityblockedhosts = '';
$CFG->curlsecurityallowedport = '';

require_once(__DIR__ . '/lib/setup.php');
