import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { SubmissionStatus } from '../enums';
import { Enrollment } from './enrollment.entity';
import { ImportBatch } from './import-batch.entity';
import { LmsActivity } from './lms-activity.entity';

/**
 * Trạng thái nộp 1 bài thực hành của 1 sinh viên (docs/rules/10). Không lưu điểm — giảng viên
 * có thể chưa chấm; cảnh báo chỉ dựa trạng thái nộp (LMS-03, LMS-04). Nạp lại = cập nhật.
 */
@Entity('lms_assignment_submissions')
@Index(['enrollmentId', 'activityId'], { unique: true })
@Index(['activityId'])
@Index(['importBatchId'])
export class LmsAssignmentSubmission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  enrollmentId!: string;

  /** Bài thực hành (`LmsActivity` loại ASSIGNMENT). */
  @Column({ type: 'uuid' })
  activityId!: string;

  @Column({ type: 'enum', enum: SubmissionStatus, enumName: 'submission_status' })
  status!: SubmissionStatus;

  /** Bắt buộc khi đã nộp — để biết đã nộp TẠI asOf (chống rò rỉ thời gian). */
  @Column({ type: 'timestamptz', nullable: true })
  submittedAt!: Date | null;

  /** Lô cập nhật gần nhất. */
  @Column({ type: 'uuid' })
  importBatchId!: string;

  @ManyToOne(() => Enrollment, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'enrollment_id' })
  enrollment?: Relation<Enrollment>;

  @ManyToOne(() => LmsActivity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'activity_id' })
  activity?: Relation<LmsActivity>;

  @ManyToOne(() => ImportBatch, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'import_batch_id' })
  importBatch?: Relation<ImportBatch>;
}
