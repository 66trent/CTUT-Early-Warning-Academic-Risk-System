import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { getEnv } from '@/lib/env';
import { SnakeNamingStrategy } from './naming-strategy';

import { AdministrativeClass } from './entities/administrative-class.entity';
import { AuditLog } from './entities/audit-log.entity';
import { Department } from './entities/department.entity';
import { Student } from './entities/student.entity';
import { Term } from './entities/term.entity';
import { User } from './entities/user.entity';
import { Phase1Identity1791766886196 } from './migrations/1791766886196-Phase1Identity';

// Entity và migration: import trực tiếp từng class — KHÔNG dùng glob (docs/rules/01).
export const ENTITIES = [User, Department, AdministrativeClass, Student, Term, AuditLog];
const MIGRATIONS = [Phase1Identity1791766886196];

const POOL_MAX = { web: 20, worker: 10 } as const;

declare global {
  var __ewarsDataSource: Promise<DataSource> | undefined;
}

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

/**
 * Singleton qua globalThis — tránh tạo nhiều pool khi hot-reload dev.
 * Cache Promise để các lời gọi song song không initialize 2 lần.
 */
export function getDataSource(): Promise<DataSource> {
  globalThis.__ewarsDataSource ??= createDataSource()
    .initialize()
    .catch((error: unknown) => {
      globalThis.__ewarsDataSource = undefined;
      throw error;
    });
  return globalThis.__ewarsDataSource;
}

export async function closeDataSource(): Promise<void> {
  const pending = globalThis.__ewarsDataSource;
  globalThis.__ewarsDataSource = undefined;
  if (!pending) return;
  const dataSource = await pending.catch(() => undefined);
  if (dataSource?.isInitialized) await dataSource.destroy();
}
