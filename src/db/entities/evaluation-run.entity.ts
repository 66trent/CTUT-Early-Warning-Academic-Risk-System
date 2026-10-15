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
import { EvaluationRunStatus, EvaluationTrigger } from '../enums';
import { Course } from './course.entity';
import { ImportBatch } from './import-batch.entity';
import { Term } from './term.entity';
import { User } from './user.entity';

/** Cảnh báo chất lượng dữ liệu phát hiện khi chạy (VD số vắng giảm giữa 2 lần nhập). */
export interface EvaluationDataWarning {
  code: string;
  studentId?: string;
  courseId?: string;
  message: string;
}

/**
 * 1 lần chạy đánh giá luật (docs/rules/11). `id` = jobId BullMQ.
 * Tối đa 1 lần chạy QUEUED / phạm vi (học kỳ, học phần) — partial unique index viết tay
 * trong migration (biểu thức COALESCE).
 */
@Entity('evaluation_runs')
@Index(['termId', 'createdAt'])
@Index('UQ_evaluation_runs_queued_scope', { synchronize: false })
export class EvaluationRun {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 10 })
  termId!: string;

  /** NULL = toàn bộ học kỳ. */
  @Column({ type: 'varchar', length: 20, nullable: true })
  courseId!: string | null;

  @Column({ type: 'enum', enum: EvaluationTrigger, enumName: 'evaluation_trigger' })
  trigger!: EvaluationTrigger;

  /** Mốc dữ liệu — chỉ dùng dữ liệu phát sinh đến thời điểm này (chống rò rỉ thời gian). */
  @Column({ type: 'timestamptz' })
  asOf!: Date;

  /** NULL khi AUTO_AFTER_IMPORT. */
  @Column({ type: 'varchar', length: 20, nullable: true })
  triggeredBy!: string | null;

  @Column({ type: 'uuid', nullable: true })
  importBatchId!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  dataWarnings!: EvaluationDataWarning[] | null;

  @Column({ type: 'enum', enum: EvaluationRunStatus, enumName: 'evaluation_run_status' })
  status!: EvaluationRunStatus;

  @Column({ type: 'int', default: 0 })
  totalStudents!: number;

  @Column({ type: 'int', default: 0 })
  processedStudents!: number;

  /** Phase 5 (tạo Alert). */
  @Column({ type: 'int', default: 0 })
  alertsCreated!: number;

  @Column({ type: 'int', default: 0 })
  alertsUpdated!: number;

  @Column({ type: 'int', default: 0 })
  insufficientCount!: number;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => Term, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'term_id' })
  term?: Relation<Term>;

  @ManyToOne(() => Course, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'course_id' })
  course?: Relation<Course> | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'triggered_by' })
  triggeredByUser?: Relation<User> | null;

  @ManyToOne(() => ImportBatch, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'import_batch_id' })
  importBatch?: Relation<ImportBatch> | null;
}
