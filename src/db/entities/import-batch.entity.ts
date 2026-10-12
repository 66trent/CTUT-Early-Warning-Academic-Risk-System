import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { ImportBatchStatus, ImportSource } from '../enums';
import { Term } from './term.entity';
import { User } from './user.entity';

/** Cảnh báo không chặn nạp (VD điểm chữ lệch điểm số) — validate bằng Zod trước khi ghi. */
export interface ImportWarning {
  row: number;
  code: string;
  message: string;
}

/** Cột `summary` — validate bằng Zod (`importSummarySchema`) trước khi ghi. */
export interface ImportBatchSummary {
  /** Header gốc theo đúng thứ tự trong file (jsonb không giữ thứ tự khóa). */
  columns?: string[];
  preview?: Record<string, string>[];
  errorRate?: number;
  confirmedAt?: string;
  confirmedBy?: string;
  retried?: boolean;
  inserted?: number;
  updated?: number;
  unchanged?: number;
  createdKeys?: string[];
}

/**
 * Lô nhập dữ liệu (docs/rules/12). Quy trình 2 bước:
 * UPLOADING → VALIDATING → STAGED → (xác nhận) LOADED → RECONCILED; hoặc REJECTED / DISCARDED / ROLLED_BACK.
 * Chống nạp trùng: partial unique index tạo bằng migration (biểu thức COALESCE, TypeORM không tự quản).
 */
@Entity('import_batches')
@Index(['status', 'createdAt'])
@Index(['dataType', 'termId', 'createdAt'])
@Index('UQ_import_batches_live_checksum', { synchronize: false })
export class ImportBatch {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Kiểu TS `ImportDataType` — varchar + Zod (docs/rules/01). */
  @Column({ type: 'varchar', length: 40 })
  dataType!: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  termId!: string | null;

  @Column({ type: 'enum', enum: ImportSource, enumName: 'import_source' })
  source!: ImportSource;

  @Column({ type: 'varchar', length: 255 })
  fileName!: string;

  /** SHA-256 (hex) nội dung file. */
  @Column({ type: 'varchar', length: 64 })
  sourceChecksum!: string;

  @Column({ type: 'varchar', length: 20 })
  performedBy!: string;

  @Column({ type: 'enum', enum: ImportBatchStatus, enumName: 'import_batch_status' })
  status!: ImportBatchStatus;

  @Column({ type: 'int', default: 0 })
  totalRows!: number;

  @Column({ type: 'int', default: 0 })
  successRows!: number;

  @Column({ type: 'int', default: 0 })
  errorRows!: number;

  @Column({ type: 'jsonb', nullable: true })
  warnings!: ImportWarning[] | null;

  /** Kết quả xem trước / nạp. */
  @Column({ type: 'jsonb', nullable: true })
  summary!: ImportBatchSummary | null;

  /** Lý do khi REJECTED (lỗi cả file). */
  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'uuid', nullable: true })
  parentBatchId!: string | null;

  /** Khóa đối tượng trong MinIO. */
  @Column({ type: 'varchar', length: 255 })
  originalFilePath!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  /** Lúc kiểm tra xong (STAGED) — dùng để tự hủy lô chờ quá 7 ngày. */
  @Column({ type: 'timestamptz', nullable: true })
  stagedAt!: Date | null;

  /** Lúc ghi xong dữ liệu (LOADED) — dùng cho điều kiện hoàn tác lô. */
  @Column({ type: 'timestamptz', nullable: true })
  loadedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @ManyToOne(() => Term, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'term_id' })
  term?: Relation<Term> | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'performed_by' })
  performer?: Relation<User>;

  @ManyToOne(() => ImportBatch, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'parent_batch_id' })
  parentBatch?: Relation<ImportBatch> | null;
}
