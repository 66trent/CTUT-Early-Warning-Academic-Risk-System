/**
 * `npm run moodle:setup` — chuẩn bị Moodle demo cho Phase 10 (docs/tich-hop-moodle.md, docs/huong-dan-moodle.md).
 * Cần Moodle đang chạy: `npm run moodle:up` (http://localhost:8080). Idempotent — chạy lại an toàn.
 *   1. Cấu hình web service CHỈ ĐỌC trên Moodle, ghi token vào `.env` (MOODLE_BASE_URL, MOODLE_WS_TOKEN).
 *   2. Tạo học kỳ demo theo ngày thật trong EWARS (HK1_2026, KHÔNG đặt làm học kỳ hiện tại — bộ v3 giữ HK1_2025).
 *   3. Dựng dữ liệu demo trên Moodle theo ngày chốt (`--cutoff=YYYY-MM-DD`, mặc định HÔM QUA): sinh
 *      docs/demo-data/moodle/moodle-demo.local.json (không commit) từ scripts/lib/moodle-demo-spec.ts.
 *   4. Gọi thử web service bằng token.
 * Tùy chọn: `--manual` chỉ tạo tài khoản (tự làm khóa học, bài, điểm danh trên Moodle) ·
 * `--reset` xóa 2 khóa học demo rồi dựng lại (BẮT BUỘC sát buổi trình diễn để bài "chương 3" còn hạn) ·
 * `--rotate-token` thu hồi token cũ, tạo token mới.
 */
import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { closeDataSource, getDataSource } from '../src/db/data-source';
import { Term } from '../src/db/entities/term.entity';
import { vnEndOfDay, vnStartOfDay } from '../src/lib/dates';
import { createMoodleClient } from '../src/modules/data-import/moodle/client';
import { buildMoodleDemoSpec, type MoodleDemoSpec, yesterdayVn } from './lib/moodle-demo-spec';

/** Bản theo ngày chốt của lần dựng này (gitignore) — thư mục gắn vào container ở /var/www/html/ewars-demo. */
const LOCAL_SPEC = 'docs/demo-data/moodle/moodle-demo.local.json';
const LOCAL_SPEC_IN_CONTAINER = '/var/www/html/ewars-demo/moodle-demo.local.json';
const ENV_PATH = '.env';
const BASE_URL = process.env.MOODLE_BASE_URL || 'http://localhost:8080';

const argv = process.argv.slice(2);
const args = new Set(argv);
const cutoff = argv.find((a) => a.startsWith('--cutoff='))?.split('=')[1] ?? yesterdayVn();

function moodlePhp(script: string, extra: string[] = []): string {
  const result = spawnSync(
    'docker',
    [
      'compose',
      '--profile',
      'moodle',
      'exec',
      '-T',
      '-u',
      'www-data',
      'moodle',
      'php',
      `/var/www/html/ewars-cli/${script}`,
      ...extra,
    ],
    { encoding: 'utf8', env: { ...process.env, MSYS_NO_PATHCONV: '1' } },
  );
  if (result.status !== 0) {
    throw new Error(
      `${script} lỗi:\n${result.stderr || result.stdout}\n(Moodle đã chạy chưa? npm run moodle:up)`,
    );
  }
  return result.stdout;
}

/** Ghi/thay 1 biến trong .env (file gitignore, chỉ ở máy). */
function setEnvVar(content: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  return pattern.test(content)
    ? content.replace(pattern, line)
    : `${content.replace(/\n?$/, '\n')}${line}\n`;
}

async function ensureTerm(spec: MoodleDemoSpec): Promise<void> {
  const repo = (await getDataSource()).getRepository(Term);
  const existing = await repo.findOneBy({ termId: spec.term.termId });
  if (existing) {
    process.stdout.write(`  học kỳ ${spec.term.termId} đã có trong EWARS — giữ nguyên\n`);
    return;
  }
  await repo.insert({
    termId: spec.term.termId,
    termName: spec.term.termName,
    academicYear: spec.term.academicYear,
    startDate: vnStartOfDay(spec.term.startDate),
    endDate: vnEndOfDay(spec.term.endDate),
    isCurrent: false,
    closedAt: null,
  });
  process.stdout.write(
    `  + học kỳ ${spec.term.termId} (${spec.term.startDate} → ${spec.term.endDate}), không phải học kỳ hiện tại\n`,
  );
}

async function main(): Promise<void> {
  const spec = buildMoodleDemoSpec(cutoff);
  writeFileSync(LOCAL_SPEC, `${JSON.stringify(spec, null, 2)}\n`);

  process.stdout.write('\n▶ 1. Web service chỉ đọc trên Moodle\n');
  const out = moodlePhp('ewars_setup.php', args.has('--rotate-token') ? ['--rotate'] : []);
  const token = /^TOKEN=(\S+)$/m.exec(out)?.[1];
  if (!token) throw new Error('Không đọc được token từ ewars_setup.php');
  process.stdout.write(out.replace(/^TOKEN=.*$/m, '  token: đã ghi vào .env (MOODLE_WS_TOKEN)'));
  let env = readFileSync(ENV_PATH, 'utf8');
  env = setEnvVar(env, 'MOODLE_BASE_URL', BASE_URL);
  env = setEnvVar(env, 'MOODLE_WS_TOKEN', token);
  writeFileSync(ENV_PATH, env);

  process.stdout.write('\n▶ 2. Học kỳ demo trong EWARS\n');
  await ensureTerm(spec);
  await closeDataSource();

  process.stdout.write(
    `\n▶ 3. Dữ liệu demo trên Moodle${args.has('--manual') ? ' (chỉ tài khoản — tự làm tay)' : ` (ngày chốt ${cutoff})`}\n`,
  );
  const seedArgs = [
    `--spec=${LOCAL_SPEC_IN_CONTAINER}`,
    args.has('--manual') ? '--accounts-only' : '',
    args.has('--reset') ? '--reset' : '',
  ].filter(Boolean);
  process.stdout.write(moodlePhp('ewars_seed_demo.php', seedArgs));

  process.stdout.write('\n▶ 4. Gọi thử web service\n');
  const client = createMoodleClient({ baseUrl: BASE_URL, token });
  const info = await client.call<{
    sitename: string;
    release: string;
    username: string;
    functions: unknown[];
  }>('core_webservice_get_site_info');
  process.stdout.write(
    `  ${info.sitename} — Moodle ${info.release}, tài khoản ${info.username}, ${info.functions.length} hàm được cấp\n`,
  );
  process.stdout.write(
    `\n✔ Xong. Moodle: ${BASE_URL} (admin / MOODLE_ADMIN_PASSWORD; giảng viên gv.moodle, sinh viên = MSSV viết thường / MOODLE_DEMO_PASSWORD)\n`,
  );
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
