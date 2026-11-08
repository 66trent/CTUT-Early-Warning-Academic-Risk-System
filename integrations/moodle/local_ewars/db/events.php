<?php
// Sự kiện EWARS cần biết (docs/tich-hop-moodle.md bảng 4b) — giữ khớp MOODLE_EVENT_NAMES ở
// src/modules/data-import/moodle/webhook.ts. Sự kiện của plugin chưa cài (VD mod_attendance) chỉ đơn
// giản là không bao giờ phát.

defined('MOODLE_INTERNAL') || die();

$ewarsevents = [
    // Điểm danh (mod_attendance).
    '\mod_attendance\event\attendance_taken',
    '\mod_attendance\event\attendance_taken_by_student',
    '\mod_attendance\event\session_added',
    '\mod_attendance\event\session_updated',
    '\mod_attendance\event\session_deleted',
    '\mod_attendance\event\session_duration_updated',
    '\mod_attendance\event\session_report_updated',
    '\mod_attendance\event\sessions_imported',
    // Tạo / sửa / xóa bài (kể cả đổi hạn nộp).
    '\core\event\course_module_created',
    '\core\event\course_module_updated',
    '\core\event\course_module_deleted',
    // Trắc nghiệm.
    '\mod_quiz\event\attempt_started',
    '\mod_quiz\event\attempt_submitted',
    '\mod_quiz\event\attempt_abandoned',
    '\mod_quiz\event\attempt_regraded',
    '\mod_quiz\event\attempt_deleted',
    '\mod_quiz\event\user_override_created',
    '\mod_quiz\event\user_override_updated',
    '\mod_quiz\event\user_override_deleted',
    // Thực hành.
    '\mod_assign\event\assessable_submitted',
    '\mod_assign\event\submission_status_updated',
    '\mod_assign\event\submission_removed',
    '\mod_assign\event\extension_granted',
    '\mod_assign\event\user_override_created',
    '\mod_assign\event\user_override_updated',
    '\mod_assign\event\user_override_deleted',
    // Ghi danh.
    '\core\event\user_enrolment_created',
    '\core\event\user_enrolment_updated',
    '\core\event\user_enrolment_deleted',
];

$observers = array_map(fn(string $name) => [
    'eventname' => $name,
    'callback' => '\local_ewars\observer::handle',
], $ewarsevents);
