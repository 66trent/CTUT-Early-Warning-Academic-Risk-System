import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { getEnv } from '@/lib/env';
import { SnakeNamingStrategy } from './naming-strategy';

import { AdministrativeClass } from './entities/administrative-class.entity';
import { AttendanceSummary } from './entities/attendance-summary.entity';
import { AuditLog } from './entities/audit-log.entity';
import { Course } from './entities/course.entity';
import { CourseResult } from './entities/course-result.entity';
import { Department } from './entities/department.entity';
import { Enrollment } from './entities/enrollment.entity';
import { ImportBatch } from './entities/import-batch.entity';
import { ImportErrorRow } from './entities/import-error-row.entity';
import { LmsQuizAttempt } from './entities/lms-quiz-attempt.entity';
import { Student } from './entities/student.entity';
import { Term } from './entities/term.entity';
import { User } from './entities/user.entity';
import { Phase1Identity1791766886196 } from './migrations/1791766886196-Phase1Identity';
import { Phase3aImport1791807992637 } from './migrations/1791807992637-Phase3aImport';
import { Phase3bSourceRecords1791810699905 } from './migrations/1791810699905-Phase3bSourceRecords';

// Entity và migration: import trực tiếp từng class — KHÔNG dùng glob (docs/rules/01).
export const ENTITIES = [
  User,
  Department,
  AdministrativeClass,
  Student,
  Term,
  AuditLog,
  ImportBatch,
  ImportErrorRow,
  Course,
  Enrollment,
  AttendanceSummary,
  LmsQuizAttempt,
  CourseResult,
];
const MIGRATIONS = [
  Phase1Identity1791766886196,
  Phase3aImport1791807992637,
  Phase3bSourceRecords1791810699905,
];

const POOL_MAX = { web: 20, worker: 10 } as const;

/**
 * Next.js production nhân bản module dùng chung giữa route handler và trang → mỗi bản sao có
 * class entity riêng; TypeORM tra metadata theo đúng đối tượng class, nên 1 DataSource dùng chung
 * sẽ báo EntityMetadataNotFoundError. Vì vậy cache theo class `User` của từng bản sao.
 * Dev (hot-reload): bản sao mới thay bản cũ → hủy DataSource cũ để không rò connection.
 */
declare global {
  var __ewarsDataSources: Map<typeof User, Promise<DataSource>> | undefined;
}

const MODULE_KEY = User;

export function createDataSource(): DataSource {
  const env = getEnv();
  return new DataSource({
    type: 'postgres',
    url: env.DATABASE_URL,
    schema: 'public',
    synchronize: false,
    migrationsRun: false,
    logging: env.NODE_ENV === 'development' ? ['error', 'warn', 'migration'] : ['error'],
    namingStrategy: new SnakeNamingStrategy(),
    entities: ENTITIES,
    migrations: MIGRATIONS,
    migrationsTableName: 'typeorm_migrations',
    extra: {
      max: POOL_MAX[env.PROCESS_ROLE],
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    },
  });
}

/** DataSource của bản sao module này — tự `initialize()` lần đầu, các lời gọi song song dùng chung Promise. */
export function getDataSource(): Promise<DataSource> {
  const cache = (globalThis.__ewarsDataSources ??= new Map<typeof User, Promise<DataSource>>());
  const existing = cache.get(MODULE_KEY);
  if (existing) return existing;

  if (process.env.NODE_ENV === 'development') {
    for (const [key, stale] of cache) {
      cache.delete(key);
      void stale.then((ds) => ds.destroy()).catch(() => undefined);
    }
  }
  const pending = createDataSource()
    .initialize()
    .catch((error: unknown) => {
      cache.delete(MODULE_KEY);
      throw error;
    });
  cache.set(MODULE_KEY, pending);
  return pending;
}

export async function closeDataSource(): Promise<void> {
  const cache = globalThis.__ewarsDataSources;
  const pending = cache?.get(MODULE_KEY);
  cache?.delete(MODULE_KEY);
  if (!pending) return;
  const dataSource = await pending.catch(() => undefined);
  if (dataSource?.isInitialized) await dataSource.destroy();
}
