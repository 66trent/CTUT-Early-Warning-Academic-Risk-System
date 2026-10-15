/**
 * npm run migration:run — chạy migration TypeORM, mỗi migration 1 transaction (docs/rules/01).
 * Yêu cầu đã chạy `npm run db:init`.
 */
import 'dotenv/config';
import { closeDataSource, getDataSource } from '../src/db/data-source';

async function main(): Promise<void> {
  const dataSource = await getDataSource();
  const executed = await dataSource.runMigrations({ transaction: 'each' });
  if (executed.length === 0) {
    console.log('migration:run — không có migration mới.');
  } else {
    console.log(`migration:run — đã chạy ${executed.length} migration:`);
    for (const migration of executed) console.log(`  - ${migration.name}`);
  }
}

main()
  .catch((error: unknown) => {
    console.error('migration:run lỗi:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => closeDataSource());
