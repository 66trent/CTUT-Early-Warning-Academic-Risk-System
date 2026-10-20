import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { ImportBatch } from './import-batch.entity';

/** 1 dòng lỗi của lô nhập (docs/rules/12) — tải về sửa rồi nạp lại. */
@Entity('import_error_rows')
@Index(['importBatchId', 'resolved'])
@Index(['importBatchId', 'sourceRowNumber'])
export class ImportErrorRow {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  importBatchId!: string;

  /** Số dòng trong file gốc (dòng header = 1). */
  @Column({ type: 'int' })
  sourceRowNumber!: number;

  /** Tên file chứa dòng lỗi (lô nhiều file — Phase 8f); NULL ở lô cũ. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  sourceFileName!: string | null;

  /** Dữ liệu nguyên trạng dòng lỗi: { header gốc: giá trị }. */
  @Column({ type: 'jsonb' })
  rawData!: Record<string, string>;

  /** Kiểu TS `ImportErrorReason` — varchar + Zod (docs/rules/01). */
  @Column({ type: 'varchar', length: 40 })
  errorReason!: string;

  /** Diễn giải cụ thể bằng tiếng Việt (VD "Lớp KTPM9999 chưa có trong hệ thống"). */
  @Column({ type: 'varchar', length: 255, nullable: true })
  errorDetail!: string | null;

  @Column({ type: 'boolean', default: false })
  resolved!: boolean;

  @ManyToOne(() => ImportBatch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'import_batch_id' })
  importBatch?: Relation<ImportBatch>;
}
