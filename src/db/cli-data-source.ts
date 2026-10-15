import 'dotenv/config';
import { createDataSource } from './data-source';

/** Chỉ dùng cho TypeORM CLI (migration:generate / revert / check). */
export default createDataSource();
