# Moodle 5.3 LTS + plugin Attendance — CHỈ để phát triển / trình diễn đồ án (Phase 10a).
# Giả lập Moodle của trường; KHÔNG phải cấu hình triển khai thật (docs/tich-hop-moodle.md).
# Ảnh nền chính thức của MoodleHQ (PHP 8.3 + Apache + đủ extension Moodle cần).
FROM moodlehq/moodle-php-apache:8.3-bookworm

# Phiên bản ghim + kiểm tra SHA-256 (mã nguồn tải về là dữ liệu ngoài — không tin nếu lệch).
ARG MOODLE_VERSION=5.3
ARG MOODLE_SHA256=7e5edf110555956571f40e42acffde0eb23681ebebd212a2fec0fe7d795dd511
ARG ATTENDANCE_COMMIT=786991c95c0e02ba8893d9d0fc60ca157f2a8bf3

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

RUN set -eux; \
    curl -fsSL -o /tmp/moodle.tgz \
      "https://download.moodle.org/download.php/direct/stable503/moodle-${MOODLE_VERSION}.tgz"; \
    echo "${MOODLE_SHA256}  /tmp/moodle.tgz" | sha256sum -c -; \
    rm -rf /var/www/html; \
    tar -xzf /tmp/moodle.tgz -C /var/www; \
    mv /var/www/moodle /var/www/html; \
    rm /tmp/moodle.tgz; \
    curl -fsSL -o /tmp/attendance.tar.gz \
      "https://github.com/danmarsden/moodle-mod_attendance/archive/${ATTENDANCE_COMMIT}.tar.gz"; \
    mkdir -p /var/www/html/public/mod/attendance; \
    tar -xzf /tmp/attendance.tar.gz --strip-components=1 -C /var/www/html/public/mod/attendance; \
    rm /tmp/attendance.tar.gz; \
    cd /var/www/html; \
    COMPOSER_ALLOW_SUPERUSER=1 composer install --no-dev --no-interaction --no-progress --classmap-authoritative; \
    mkdir -p /var/www/moodledata; \
    chown -R www-data:www-data /var/www/html /var/www/moodledata

# Moodle ≥ 5.1: thư mục web là `public/`; định tuyến mới cần FallbackResource /r.php.
ENV APACHE_DOCUMENT_ROOT=/var/www/html/public
RUN set -eux; \
    printf '<Directory /var/www/html/public>\n  AllowOverride None\n  FallbackResource /r.php\n</Directory>\n' \
      > /etc/apache2/conf-enabled/moodle.conf

COPY config.php /var/www/html/config.php
COPY entrypoint.sh /usr/local/bin/ewars-moodle-entrypoint
RUN chmod 0755 /usr/local/bin/ewars-moodle-entrypoint
# Script CLI của EWARS (integrations/moodle/cli) được gắn vào /var/www/html/ewars-cli (docker-compose).

EXPOSE 80
ENTRYPOINT ["/usr/local/bin/ewars-moodle-entrypoint"]
