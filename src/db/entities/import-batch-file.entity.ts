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
import { ImportBatch } from './import-batch.entity';

/**
 * 1 file của 1 lô nhập (docs/rules/12, Phase 8f — nạp nhiều file 1 lần). Lô trước 8f được
 * migration điền 1 dòng từ cột của `ImportBatch`.
 */
@Entity('import_batch_files')
@Index(['importBatchId', 'fileOrder'], { unique: true })
@Index(['sourceChecksum'])
export class ImportBatchFile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  importBatchId!: string;

  /** Thứ tự tải lên, từ 1. */
  @Column({ type: 'int' })
  fileOrder!: number;

  @Column({ type: 'varchar', length: 255 })
  fileName!: string;

  /** SHA-256 (hex) nội dung file — chống nạp trùng từng file. */
  @Column({ type: 'varchar', length: 64 })
  sourceChecksum!: string;

  /** Khóa đối tượng trong MinIO. */
  @Column({ type: 'varchar', length: 255 })
  originalFilePath!: string;

  @Column({ type: 'int' })
  sizeBytes!: number;

  @Column({ type: 'int', default: 0 })
  totalRows!: number;

  @Column({ type: 'int', default: 0 })
  successRows!: number;

  @Column({ type: 'int', default: 0 })
  errorRows!: number;

  /** Học phần nhận diện trong file (bảng từng file ở màn xem trước). */
  @Column({ type: 'varchar', length: 20, array: true, default: () => "'{}'" })
  courseIds!: string[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => ImportBatch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'import_batch_id' })
  importBatch?: Relation<ImportBatch>;
}
