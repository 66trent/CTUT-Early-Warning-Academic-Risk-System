<?php
// CTUT-EWARS — nhận sự kiện Moodle, xếp 1 adhoc task gửi sang EWARS (không gửi ngay lúc sinh viên bấm
// nộp → không làm chậm Moodle; EWARS tạm dừng thì task tự thử lại).

namespace local_ewars;

defined('MOODLE_INTERNAL') || die();

class observer {
    /** Chỉ khóa có Course ID number 12 chữ số (= mã lớp học phần) — khóa khác EWARS không liên kết. */
    private const SECTION_CODE = '/^\d{12}$/';

    public static function handle(\core\event\base $event): void {
        global $DB;
        if (empty(get_config('local_ewars', 'eventsurl')) || empty(get_config('local_ewars', 'secret'))) {
            return;
        }
        $courseid = (int) $event->courseid;
        if ($courseid <= 0 || $courseid == SITEID) {
            return;
        }
        $idnumber = (string) $DB->get_field('course', 'idnumber', ['id' => $courseid]);
        if (!preg_match(self::SECTION_CODE, trim($idnumber))) {
            return;
        }
        $task = new task\send_event();
        $task->set_custom_data([
            'id' => \core\uuid::generate(),
            'eventname' => $event->eventname,
            'courseid' => $courseid,
            'objectid' => $event->objectid === null ? null : (int) $event->objectid,
            'timecreated' => (int) $event->timecreated,
        ]);
        \core\task\manager::queue_adhoc_task($task);
    }
}
