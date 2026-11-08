<?php
// Plugin không lưu dữ liệu người dùng. Gửi sang EWARS chỉ tên sự kiện + mã khóa học / đối tượng (không
// có mã người dùng, điểm, họ tên) — khai báo nơi nhận bên ngoài để minh bạch (Luật 91/2025/QH15).

namespace local_ewars\privacy;

defined('MOODLE_INTERNAL') || die();

use core_privacy\local\metadata\collection;

class provider implements \core_privacy\local\metadata\provider, \core_privacy\local\request\data_provider {
    public static function get_metadata(collection $collection): collection {
        $collection->add_external_location_link('ewars', [
            'courseid' => 'privacy:metadata:ewars:courseid',
            'objectid' => 'privacy:metadata:ewars:objectid',
            'eventname' => 'privacy:metadata:ewars:eventname',
        ], 'privacy:metadata:ewars');
        return $collection;
    }
}
