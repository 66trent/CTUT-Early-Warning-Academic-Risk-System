/**
 * npm run demo:reset -- --yes — đưa DB về trạng thái demo chuẩn trước giờ bảo vệ:
 *   sao lưu (npm run backup) → XÓA toàn bộ dữ liệu (schema public + auth) → db:init →
 *   migration:run → seed → seed:demo → nạp 5 file demo qua quy trình nhập thật (worker xử lý).
 * Chỉ khi DEMO_MODE=true; bắt buộc `--yes`. Cần container postgres, redis, minio, worker đang chạy.
 * `--evaluate`: chạy luôn 2 mốc chính thức của KET_QUA_MONG_DOI.md (HK2_2025 mốc 15/06, HK1_2026
 * mốc 10/10) — dùng để tập dượt / chụp ảnh; khi trình bày thật nên bấm chạy trước hội đồng.
 * Sau khi chạy: đăng nhập lại (mọi phiên cũ bị xóa).
 */
import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { Client } from 'pg';
import { closeDataSource, getDataSource } from '../src/db/data-source';
import { EvaluationRun } from '../src/db/entities/evaluation-run.entity';
import { EvaluationRunStatus, EvaluationTrigger } from '../src/db/enums';
import { SEED_ADMIN_USER_ID } from '../src/db/seeds/base-seed';
import { vnEndOfDay } from '../src/lib/dates';
import { getEnv } from '../src/lib/env';
import { requestEvaluation } from '../src/modules/rule-engine/services/evaluation-run.service';

/** 2 mốc chính thức của docs/demo-data/KET_QUA_MONG_DOI.md. */
const OFFICIAL_RUNS = [
  ['HK2_2025', '2026-06-15'],
  ['HK1_2026', '2026-10-10'],
] as const;

/** Đưa lần chạy vào hàng đợi rồi chờ worker chạy xong (tối đa 2 phút). */
async function runOfficial(): Promise<void> {
  const repo = (await getDataSource()).getRepository(EvaluationRun);
  for (const [termId, asOf] of OFFICIAL_RUNS) {
    const runId = await requestEvaluation({
      termId,
      courseId: null,
      trigger: EvaluationTrigger.MANUAL,
      asOf: vnEndOfDay(asOf),
      actorId: SEED_ADMIN_USER_ID,
      importBatchId: null,
    });
    if (!runId) throw new Error(`Không tạo được lần chạy ${termId}.`);
    for (let i = 0; i < 240; i += 1) {
      const run = await repo.findOneByOrFail({ id: runId });
      if (run.status === EvaluationRunStatus.COMPLETED) {
        process.stdout.write(`  ${termId} mốc ${asOf}: xong, ${run.alertsCreated} cảnh báo mới\n`);
        break;
      }
      if (run.status === EvaluationRunStatus.FAILED) throw new Error(`${termId}: lần chạy lỗi`);
      if (i === 239) throw new Error(`${termId}: worker chưa chạy xong sau 2 phút`);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  await closeDataSource();
}

function step(title: string, script: string, args: string[] = []): void {
  process.stdout.write(`\n▶ ${title}\n`);
  const result = spawnSync('npm', ['run', '-s', script, ...(args.length ? ['--', ...args] : [])], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) throw new Error(`Bước "${title}" lỗi (npm run ${script}).`);
}

async function wipe(): Promise<void> {
  process.stdout.write('\n▶ Xóa toàn bộ dữ liệu (schema public + auth)\n');
  const client = new Client({ connectionString: getEnv().DATABASE_URL });
  await client.connect();
  try {
    await client.query('DROP SCHEMA IF EXISTS auth CASCADE');
    await client.query('DROP SCHEMA IF EXISTS public CASCADE');
    await client.query('CREATE SCHEMA public');
  } finally {
    await client.end();
  }
}

async function main(): Promise<void> {
  if (!getEnv().DEMO_MODE) throw new Error('demo:reset chỉ chạy khi DEMO_MODE=true.');
  if (!process.argv.includes('--yes')) {
    throw new Error(
      'demo:reset XÓA TOÀN BỘ dữ liệu rồi dựng lại bộ demo. Chạy lại với --yes nếu chắc chắn:\n  npm run demo:reset -- --yes',
    );
  }
  step('Sao lưu trước khi xóa', 'backup');
  await wipe();
  step('Tạo schema auth + bảng Better Auth', 'db:init');
  step('Chạy migration', 'migration:run');
  step('Dữ liệu nền (khoa, Admin, 10 luật)', 'seed');
  step('Dữ liệu nền demo (GV001, GV002, lớp, học kỳ)', 'seed:demo');
  step('Nạp 5 file demo qua worker', 'demo:load', ['--with-students']);
  if (process.argv.includes('--evaluate')) {
    process.stdout.write('\n▶ Chạy đánh giá 2 mốc chính thức\n');
    await runOfficial();
  }
  process.stdout.write(
    '\n✔ Xong. Đăng nhập lại; mở Admin → Chạy đánh giá để chạy 2 mốc trong KET_QUA_MONG_DOI.md.\n',
  );
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`\n✖ ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  // Kết nối Redis của hàng đợi (khi --evaluate) giữ tiến trình sống — thoát tường minh.
  .finally(() => process.exit());
