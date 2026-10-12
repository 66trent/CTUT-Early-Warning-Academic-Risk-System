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
 * Số liệu điểm danh tổng hợp của 1 Enrollment tại 1 ngày chốt (docs/rules/10).
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

  /** Số buổi ĐÃ học tính đến ngày chốt. */
  @Column({ type: 'int' })
  totalSessions!: number;

  /** Tổng số buổi theo kế hoạch (nếu nguồn có). */
  @Column({ type: 'int', nullable: true })
  plannedSessions!: number | null;

  @Column({ type: 'int' })
  present!: number;

  @Column({ type: 'int' })
  late!: number;

  @Column({ type: 'int' })
  excusedAbsence!: number;

  @Column({ type: 'int' })
  unexcusedAbsence!: number;

  @Column({ type: 'varchar', length: 30, nullable: true })
  sectionCode!: string | null;

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
