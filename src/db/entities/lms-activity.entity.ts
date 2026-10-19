import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { LmsActivityType } from '../enums';
import { Course } from './course.entity';
import { ImportBatch } from './import-batch.entity';
import { Term } from './term.entity';

/**
 * 1 bài trên LMS của 1 lớp học phần (docs/rules/10): trắc nghiệm hoặc bài thực hành, 1 hạn nộp
 * / bài. Sinh viên chỉ bị xét bài của lớp học phần mình (`Enrollment.sectionCode`).
 */
@Entity('lms_activities')
@Index(['courseId', 'termId', 'sectionCode', 'activityType', 'activityKey'], { unique: true })
@Index(['importBatchId'])
export class LmsActivity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 20 })
  courseId!: string;

  @Column({ type: 'varchar', length: 10 })
  termId!: string;

  @Column({ type: 'varchar', length: 30 })
  sectionCode!: string;

  @Column({ type: 'enum', enum: LmsActivityType, enumName: 'lms_activity_type' })
  activityType!: LmsActivityType;

  /** `ma_bai`, hoặc tên bài đã chuẩn hóa khi nguồn không có mã. */
  @Column({ type: 'varchar', length: 100 })
  activityKey!: string;

  @Column({ type: 'varchar', length: 200 })
  activityName!: string;

  /** Hạn nộp — bắt buộc với bài thực hành, tùy chọn với trắc nghiệm. */
  @Column({ type: 'timestamptz', nullable: true })
  dueAt!: Date | null;

  /** Lô cập nhật gần nhất. */
  @Column({ type: 'uuid' })
  importBatchId!: string;

  @ManyToOne(() => Course, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'course_id' })
  course?: Relation<Course>;

  @ManyToOne(() => Term, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'term_id' })
  term?: Relation<Term>;

  @ManyToOne(() => ImportBatch, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'import_batch_id' })
  importBatch?: Relation<ImportBatch>;
}
