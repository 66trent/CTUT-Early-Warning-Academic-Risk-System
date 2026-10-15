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

/**
 * 1 lượt làm bài kiểm tra trên LMS (docs/rules/10). Chỉ lưu lượt có thật —
 * bài bị bỏ được rule-engine suy ra (LMS-01). Nạp lại cùng lượt = cập nhật.
 */
@Entity('lms_quiz_attempts')
@Index(['enrollmentId', 'quizKey', 'attemptNumber'], { unique: true })
@Index(['importBatchId'])
export class LmsQuizAttempt {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  enrollmentId!: string;

  /** `ma_bai`, hoặc tên bài đã chuẩn hóa khi nguồn không có mã. */
  @Column({ type: 'varchar', length: 100 })
  quizKey!: string;

  @Column({ type: 'varchar', length: 200 })
  quizName!: string;

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

  @Column({ type: 'enum', enum: QuizAttemptStatus, enumName: 'quiz_attempt_status' })
  status!: QuizAttemptStatus;

  @Column({ type: 'varchar', length: 30, nullable: true })
  sectionCode!: string | null;

  /** Lô cập nhật gần nhất. */
  @Column({ type: 'uuid' })
  importBatchId!: string;

  @ManyToOne(() => Enrollment, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'enrollment_id' })
  enrollment?: Relation<Enrollment>;

  @ManyToOne(() => ImportBatch, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'import_batch_id' })
  importBatch?: Relation<ImportBatch>;
}
