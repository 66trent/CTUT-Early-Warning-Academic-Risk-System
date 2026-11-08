<?php
// CTUT-EWARS — plugin báo sự kiện Moodle sang EWARS (Phase 10c, docs/tich-hop-moodle.md mục 4, 4b).
// Chỉ gửi "chuông báo" (tên sự kiện + mã số, ký HMAC) — không gửi điểm, họ tên, nội dung bài.
// EWARS nhận chuông rồi tự gọi lại web service chỉ đọc để lấy dữ liệu.

defined('MOODLE_INTERNAL') || die();

$plugin->component = 'local_ewars';
$plugin->version   = 2026110801;
$plugin->requires  = 2026081800; // Moodle 5.3.
$plugin->maturity  = MATURITY_BETA;
$plugin->release   = '0.1 (Phase 10c)';
