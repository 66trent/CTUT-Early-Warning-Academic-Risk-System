/**
 * Sao lưu / khôi phục PostgreSQL qua container `postgres` của Docker Compose (docs/rules/01, 04).
 *
 *   npm run backup                      → backups/ewars-YYYYMMDD-HHmmss.dump (giữ 7 bản mới nhất)
 *   npm run restore -- <file>           → khôi phục vào DB THỬ `<db>_restore` (không đụng DB chính)
 *   npm run restore -- <file> --into-main --yes
 *                                       → GHI ĐÈ DB chính (dừng app + worker trước!)
 *
 * Định dạng custom (`pg_dump -Fc`). Thư mục `backups/` đã .gitignore; dữ liệu cá nhân → bảo vệ
 * file sao lưu như dữ liệu thật (docs/rules/04). Đặt lịch chạy hằng ngày: xem README.
 */
import 'dotenv/config';
import { spawn } from 'node:child_process';
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import path from 'node:path';

const BACKUP_DIR = path.resolve('backups');
const KEEP = 7;
const PREFIX = 'ewars-';

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Thiếu biến môi trường ${name} (đọc từ .env).`);
  return value;
}

/** Chạy lệnh trong container postgres; tùy chọn nối stdin/stdout với file. */
function compose(
  args: string[],
  io: { stdinFile?: string; stdoutFile?: string } = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', ['compose', 'exec', '-T', 'postgres', ...args], {
      stdio: [io.stdinFile ? 'pipe' : 'ignore', io.stdoutFile ? 'pipe' : 'inherit', 'inherit'],
    });
    if (io.stdinFile && child.stdin) createReadStream(io.stdinFile).pipe(child.stdin);
    // Chờ cả tiến trình kết thúc VÀ file ghi xong (tránh file sao lưu bị cắt cụt).
    const written = new Promise<void>((done) => {
      if (!io.stdoutFile || !child.stdout) return done();
      const out = createWriteStream(io.stdoutFile);
      out.on('finish', () => done());
      child.stdout.pipe(out);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`${args[0]} thoát với mã ${code}`));
      void written.then(resolve);
    });
  });
}

/** Tên file theo giờ Việt Nam: YYYYMMDD-HHmmss. */
const stamp = () =>
  new Date(Date.now() + 7 * 3600_000)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '-')
    .slice(0, 15);

async function backup(): Promise<void> {
  mkdirSync(BACKUP_DIR, { recursive: true });
  const file = path.join(BACKUP_DIR, `${PREFIX}${stamp()}.dump`);
  const started = Date.now();
  await compose(['pg_dump', '-U', env('POSTGRES_USER'), '-d', env('POSTGRES_DB'), '-Fc'], {
    stdoutFile: file,
  });
  const sizeKb = Math.round(statSync(file).size / 1024);
  process.stdout.write(
    `Đã sao lưu ${file} (${sizeKb} KB, ${(Date.now() - started) / 1000} giây)\n`,
  );
  // Chỉ xóa bản sao lưu tự động cũ (tên ewars-*.dump), giữ 7 bản mới nhất; không đụng file khác.
  const old = readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith(PREFIX) && f.endsWith('.dump'))
    .sort()
    .slice(0, -KEEP);
  for (const f of old) {
    rmSync(path.join(BACKUP_DIR, f));
    process.stdout.write(`Xóa bản cũ ${f}\n`);
  }
}

async function restore(file: string, intoMain: boolean): Promise<void> {
  if (!existsSync(file)) throw new Error(`Không thấy file ${file}`);
  const user = env('POSTGRES_USER');
  const main = env('POSTGRES_DB');
  const target = intoMain ? main : `${main}_restore`;
  const started = Date.now();
  if (!intoMain) {
    await compose(['psql', '-U', user, '-d', main, '-c', `DROP DATABASE IF EXISTS "${target}"`]);
    await compose(['psql', '-U', user, '-d', main, '-c', `CREATE DATABASE "${target}"`]);
  }
  await compose(
    [
      'pg_restore',
      '-U',
      user,
      '-d',
      target,
      '--clean',
      '--if-exists',
      '--no-owner',
      '--exit-on-error',
    ],
    { stdinFile: path.resolve(file) },
  );
  process.stdout.write(
    `Đã khôi phục ${file} vào DB "${target}" trong ${(Date.now() - started) / 1000} giây\n`,
  );
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  if (command === 'backup') return backup();
  if (command === 'restore') {
    const file = rest.find((a) => !a.startsWith('--'));
    if (!file) throw new Error('Cách dùng: npm run restore -- <file.dump> [--into-main --yes]');
    const intoMain = rest.includes('--into-main');
    if (intoMain && !rest.includes('--yes')) {
      throw new Error('Ghi đè DB chính cần thêm --yes (nhớ dừng app + worker trước).');
    }
    return restore(file, intoMain);
  }
  throw new Error('Lệnh: backup | restore');
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
