<?php
defined('MOODLE_INTERNAL') || die();

$string['pluginname'] = 'EWARS early warning connector';
$string['eventsurl'] = 'EWARS events URL';
$string['eventsurl_desc'] = 'Full URL of the EWARS endpoint, e.g. https://ewars.example.edu.vn/api/integrations/moodle/events. Leave empty to stop sending.';
$string['secret'] = 'Shared secret';
$string['secret_desc'] = 'HMAC-SHA256 key shared with EWARS (MOODLE_WEBHOOK_SECRET, at least 32 characters).';
$string['sendevent'] = 'Send event to EWARS';
$string['senderror'] = 'Could not deliver event to EWARS: {$a}';
$string['privacy:metadata:ewars'] = 'Event notifications (no user data) are sent to the EWARS early warning system, which then reads data through the read-only web service.';
$string['privacy:metadata:ewars:courseid'] = 'Course id where the event happened.';
$string['privacy:metadata:ewars:objectid'] = 'Id of the object of the event (attempt, submission, session…).';
$string['privacy:metadata:ewars:eventname'] = 'Event class name.';
