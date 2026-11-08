import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { QuizAttemptStatus } from '../enums';
import { Enrollment } from './enrollment.entity';
import { ImportBatch } from './import-batch.entity';
import { LmsActivity } from './lms-activity.entity';

/**
 * 1 lượt làm bài trắc nghiệm trên LMS (docs/rules/10). Chỉ lưu lượt có thật —
 * bài bị bỏ được rule-engine suy ra (LMS-01). Nạp lại cùng lượt = cập nhật.
 */
@Entity('lms_quiz_attempts')
@Index(['enrollmentId', 'activityId', 'attemptNumber'], { unique: true })
@Index(['activityId'])
@Index(['importBatchId'])
export class LmsQuizAttempt {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  enrollmentId!: string;

  /** Bài trắc nghiệm (`LmsActivity` loại QUIZ). */
  @Column({ type: 'uuid' })
  activityId!: string;

  @Column({ type: 'int' })
  attemptNumber!: number;

  @Column({ type: 'timestamptz' })
  startedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  submittedAt!: Date | null;

  @Column({ type: 'double precision', nullable: true })
  durationMinutes!: number | null;

  @Column({ type: 'double precision', nullable: true })
  score!: number | null;

  @Column({ type: 'double precision', nullable: true })
  maxScore!: number | null;

  /** Số câu làm đúng — chỉ hiển thị, không dùng để cảnh báo. */
  @Column({ type: 'int', nullable: true })
  correctCount!: number | null;

  @Column({ type: 'int', nullable: true })
  totalQuestions!: number | null;

  @Column({ type: 'enum', enum: QuizAttemptStatus, enumName: 'quiz_attempt_status' })
  status!: QuizAttemptStatus;

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
