<?php
// CTUT-EWARS — gửi 1 sự kiện sang EWARS: POST JSON, ký HMAC-SHA256(khóa bí mật, "<timestamp>.<thân>").
// Lỗi mạng / EWARS lỗi 5xx / 429 → ném lỗi để Moodle thử lại adhoc task (giãn dần). 4xx khác (chữ ký
// sai, sự kiện không hợp lệ) → bỏ, không thử lại.

namespace local_ewars\task;

defined('MOODLE_INTERNAL') || die();

require_once($CFG->libdir . '/filelib.php');

class send_event extends \core\task\adhoc_task {
    public function get_name(): string {
        return get_string('sendevent', 'local_ewars');
    }

    public function execute(): void {
        $url = trim((string) get_config('local_ewars', 'eventsurl'));
        $secret = (string) get_config('local_ewars', 'secret');
        if ($url === '' || $secret === '') {
            mtrace('local_ewars: chưa cấu hình URL / khóa bí mật — bỏ sự kiện.');
            return;
        }
        $data = $this->get_custom_data();
        $body = json_encode([
            'id' => (string) $data->id,
            'eventname' => (string) $data->eventname,
            'courseid' => (int) $data->courseid,
            'objectid' => $data->objectid === null ? null : (int) $data->objectid,
            'timecreated' => (int) $data->timecreated,
        ], JSON_UNESCAPED_SLASHES);
        $timestamp = time();
        $signature = 'sha256=' . hash_hmac('sha256', $timestamp . '.' . $body, $secret);

        $curl = new \curl();
        $curl->setHeader([
            'Content-Type: application/json',
            'X-EWARS-Timestamp: ' . $timestamp,
            'X-EWARS-Signature: ' . $signature,
        ]);
        $curl->post($url, $body, ['CURLOPT_TIMEOUT' => 10, 'CURLOPT_CONNECTTIMEOUT' => 5]);
        $code = (int) ($curl->get_info()['http_code'] ?? 0);
        if ($curl->get_errno() || $code === 0 || $code === 429 || $code >= 500) {
            throw new \moodle_exception('senderror', 'local_ewars', '', $code . ' ' . $curl->error);
        }
        if ($code >= 400) {
            mtrace("local_ewars: EWARS từ chối sự kiện {$data->eventname} (HTTP {$code}) — không thử lại.");
            return;
        }
        mtrace("local_ewars: đã gửi {$data->eventname} khóa {$data->courseid} (HTTP {$code}).");
    }
}
