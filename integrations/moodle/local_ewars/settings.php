<?php
// Trang cài đặt: Quản trị trang → Plugin → Plugin cục bộ → EWARS. `ewars_setup.php` điền sẵn cho demo.

defined('MOODLE_INTERNAL') || die();

if ($hassiteconfig) {
    $settings = new admin_settingpage('local_ewars', get_string('pluginname', 'local_ewars'));
    $settings->add(new admin_setting_configtext(
        'local_ewars/eventsurl',
        get_string('eventsurl', 'local_ewars'),
        get_string('eventsurl_desc', 'local_ewars'),
        '',
        PARAM_URL
    ));
    $settings->add(new admin_setting_configpasswordunmask(
        'local_ewars/secret',
        get_string('secret', 'local_ewars'),
        get_string('secret_desc', 'local_ewars'),
        ''
    ));
    $ADMIN->add('localplugins', $settings);
}
