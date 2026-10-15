import { getEnv } from '@/lib/env';
import { logger } from '@/lib/logger';

/** Thiếu/sai biến môi trường → in danh sách biến lỗi rồi thoát hẳn (Next chỉ log, không tự dừng). */
export function assertEnvOrExit(): Promise<void> {
  try {
    getEnv();
  } catch (error) {
    logger.fatal(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
  return Promise.resolve();
}
