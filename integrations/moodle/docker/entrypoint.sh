#!/bin/bash
# Khởi động Moodle demo: chờ DB → cài lần đầu hoặc nâng cấp (cài plugin mới) → cron mỗi phút → Apache.
set -euo pipefail

cd /var/www/html
chown -R www-data:www-data /var/www/moodledata

as_www() { runuser -u www-data -- "$@"; }

echo "[moodle] chờ PostgreSQL ${MOODLE_DB_HOST:-moodle-db}…"
until php -r 'exit(@pg_connect(sprintf("host=%s dbname=%s user=%s password=%s connect_timeout=3",
    getenv("MOODLE_DB_HOST") ?: "moodle-db", getenv("MOODLE_DB_NAME") ?: "moodle",
    getenv("MOODLE_DB_USER") ?: "moodle", getenv("MOODLE_DB_PASSWORD") ?: "")) ? 0 : 1);'; do
  sleep 2
done

installed=$(php -r '$c = pg_connect(sprintf("host=%s dbname=%s user=%s password=%s",
    getenv("MOODLE_DB_HOST") ?: "moodle-db", getenv("MOODLE_DB_NAME") ?: "moodle",
    getenv("MOODLE_DB_USER") ?: "moodle", getenv("MOODLE_DB_PASSWORD") ?: ""));
    echo pg_fetch_result(pg_query($c, "SELECT to_regclass(\x27mdl_config\x27) IS NOT NULL"), 0, 0);')

if [ "$installed" != "t" ]; then
  echo "[moodle] cài đặt lần đầu (vài phút)…"
  : "${MOODLE_ADMIN_PASSWORD:?Thiếu MOODLE_ADMIN_PASSWORD}"
  as_www php admin/cli/install_database.php --agree-license \
    --fullname="Moodle demo CTUT-EWARS" --shortname="moodle-ewars" \
    --summary="Moodle 5.3 giả lập Moodle của trường để thử đồng bộ dữ liệu" \
    --adminuser=admin --adminpass="$MOODLE_ADMIN_PASSWORD" \
    --adminemail="${MOODLE_ADMIN_EMAIL:-admin@moodle.local}"
else
  echo "[moodle] đã cài — kiểm tra nâng cấp / plugin mới…"
  as_www php admin/cli/upgrade.php --non-interactive
fi

# Cron Moodle mỗi phút (adhoc task của plugin local_ewars chạy ở đây — Phase 10c).
( while true; do as_www php admin/cli/cron.php > /dev/null 2>&1 || true; sleep 60; done ) &

exec apache2-foreground
