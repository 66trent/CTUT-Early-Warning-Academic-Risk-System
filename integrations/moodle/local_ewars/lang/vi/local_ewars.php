<?php
defined('MOODLE_INTERNAL') || die();

$string['pluginname'] = 'Kết nối cảnh báo sớm EWARS';
$string['eventsurl'] = 'URL nhận sự kiện của EWARS';
$string['eventsurl_desc'] = 'Đường dẫn đầy đủ, VD https://ewars.ctuet.edu.vn/api/integrations/moodle/events. Để trống = ngừng gửi.';
$string['secret'] = 'Khóa bí mật';
$string['secret_desc'] = 'Khóa HMAC-SHA256 dùng chung với EWARS (MOODLE_WEBHOOK_SECRET, tối thiểu 32 ký tự).';
$string['sendevent'] = 'Gửi sự kiện sang EWARS';
$string['senderror'] = 'Không gửi được sự kiện sang EWARS: {$a}';
$string['privacy:metadata:ewars'] = 'Thông báo sự kiện (không có dữ liệu người dùng) được gửi tới hệ thống cảnh báo sớm EWARS; EWARS tự đọc dữ liệu qua web service chỉ đọc.';
$string['privacy:metadata:ewars:courseid'] = 'Mã khóa học nơi xảy ra sự kiện.';
$string['privacy:metadata:ewars:objectid'] = 'Mã đối tượng của sự kiện (lượt làm, bài nộp, buổi điểm danh…).';
$string['privacy:metadata:ewars:eventname'] = 'Tên lớp sự kiện.';
