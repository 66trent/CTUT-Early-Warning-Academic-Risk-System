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
import { AttemptOutcome, EnrollmentStatus } from '../enums';
import { Course } from './course.entity';
import { ImportBatch } from './import-batch.entity';
import { Student } from './student.entity';
import { Term } from './term.entity';

/**
 * Sinh viên × học phần × học kỳ (docs/rules/09) — bảng trung tâm, mọi dữ liệu nguồn trỏ qua đây.
 * Tự tạo khi dòng nguồn đầu tiên của (mssv, ma_hoc_phan) được nạp; không có file đăng ký riêng.
 */
@Entity('enrollments')
@Index(['studentId', 'courseId', 'termId'], { unique: true })
@Index(['termId', 'courseId'])
@Index(['firstSeenBatchId'])
export class Enrollment {
  @PrimaryGeneratedColumn('uuid')
  enrollmentId!: string;

  @Column({ type: 'varchar', length: 20 })
  studentId!: string;

  @Column({ type: 'varchar', length: 20 })
  courseId!: string;

  @Column({ type: 'varchar', length: 10 })
  termId!: string;

  @Column({ type: 'enum', enum: EnrollmentStatus, enumName: 'enrollment_status' })
  enrollmentStatus!: EnrollmentStatus;

  /** = 1 + số học kỳ TRƯỚC có kết quả FAILED cho cùng (sinh viên, học phần). */
  @Column({ type: 'int' })
  attemptNumber!: number;

  @Column({
    type: 'enum',
    enum: AttemptOutcome,
    enumName: 'attempt_outcome',
    default: AttemptOutcome.PENDING,
  })
  attemptOutcome!: AttemptOutcome;

  /** Lớp học phần hiện tại (`ma_lop_hoc_phan` của dòng nguồn gần nhất) — bài LMS chỉ xét cùng lớp. */
  @Column({ type: 'varchar', length: 30, nullable: true })
  sectionCode!: string | null;

  @Column({ type: 'uuid' })
  firstSeenBatchId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => Student, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'student_id' })
  student?: Relation<Student>;

  @ManyToOne(() => Course, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'course_id' })
  course?: Relation<Course>;

  @ManyToOne(() => Term, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'term_id' })
  term?: Relation<Term>;

  @ManyToOne(() => ImportBatch, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'first_seen_batch_id' })
  firstSeenBatch?: Relation<ImportBatch>;
}
