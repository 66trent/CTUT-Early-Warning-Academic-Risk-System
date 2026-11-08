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
import { Enrollment } from './enrollment.entity';
import { ImportBatch } from './import-batch.entity';

/**
 * Số liệu điểm danh tổng hợp của 1 Enrollment tại 1 ngày chốt, đơn vị TIẾT (docs/rules/10).
 * Giữ mọi ngày chốt (ATT-02 cần lịch sử); nạp lại cùng ngày chốt = cập nhật.
 */
@Entity('attendance_summaries')
@Index(['enrollmentId', 'snapshotDate'], { unique: true })
@Index(['importBatchId'])
export class AttendanceSummary {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  enrollmentId!: string;

  /** Ngày chốt — 00:00 giờ Việt Nam. */
  @Column({ type: 'timestamptz' })
  snapshotDate!: Date;

  /** Tổng số tiết của học phần (`tong_so_tiet`) — mẫu số ATT-01. */
  @Column({ type: 'int' })
  totalPeriods!: number;

  /** Số tiết vắng có phép, cộng dồn đến ngày chốt. */
  @Column({ type: 'int' })
  excusedAbsence!: number;

  /** Số tiết vắng không phép, cộng dồn đến ngày chốt. */
  @Column({ type: 'int' })
  unexcusedAbsence!: number;

  /** Mã lớp học phần của dòng (`ma_lop_hoc_phan`). */
  @Column({ type: 'varchar', length: 30 })
  sectionCode!: string;

  /** Lô cập nhật gần nhất. */
  @Column({ type: 'uuid' })
  importBatchId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => Enrollment, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'enrollment_id' })
  enrollment?: Relation<Enrollment>;

  @ManyToOne(() => ImportBatch, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'import_batch_id' })
  importBatch?: Relation<ImportBatch>;
}
