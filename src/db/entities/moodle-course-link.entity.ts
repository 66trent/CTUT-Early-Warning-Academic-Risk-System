import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';
import { Term } from './term.entity';

/** Sinh viên Moodle chưa có trong EWARS ở lần đồng bộ gần nhất (bỏ qua, đếm riêng — docs/rules/12). */
export interface MoodleUnknownStudent {
  moodleUserId: number;
  idnumber: string | null;
  email: string | null;
}

/**
 * Liên kết 1 khóa học Moodle (= 1 lớp học phần) với 1 học kỳ EWARS (Phase 10b — docs/rules/12,
 * docs/tich-hop-moodle.md). Admin bật từng khóa (mặc định tắt); chỉ khóa có Course ID number 12 số.
 */
@Entity('moodle_course_links')
@Index(['moodleCourseId', 'termId'], { unique: true })
export class MoodleCourseLink {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** `course.id` của Moodle. */
  @Column({ type: 'int' })
  moodleCourseId!: number;

  @Column({ type: 'varchar', length: 10 })
  termId!: string;

  /** Mã lớp học phần = Course ID number của khóa Moodle. */
  @Column({ type: 'varchar', length: 30 })
  sectionCode!: string;

  /** Mã học phần (mặc định = mã lớp học phần bỏ 2 số cuối; Admin sửa được) → cột `ma_hoc_phan`. */
  @Column({ type: 'varchar', length: 20 })
  courseId!: string;

  /** Tên học phần → cột `ten_hoc_phan` (dùng khi tự tạo `Course`). */
  @Column({ type: 'varchar', length: 150 })
  courseName!: string;

  @Column({ type: 'varchar', length: 255 })
  moodleShortname!: string;

  @Column({ type: 'varchar', length: 255 })
  moodleFullname!: string;

  @Column({ type: 'boolean', default: false })
  enabled!: boolean;

  /** Ghi đè tổng số tiết (NULL = tổng thời lượng các buổi đã tạo ÷ số phút 1 tiết). */
  @Column({ type: 'int', nullable: true })
  totalPeriodsOverride!: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastSyncAt!: Date | null;

  /** Lỗi gần nhất khi đọc khóa học này từ Moodle (NULL = lần gần nhất đọc được). */
  @Column({ type: 'text', nullable: true })
  lastError!: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  unknownStudents!: MoodleUnknownStudent[];

  @Column({ type: 'varchar', length: 20 })
  updatedBy!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => Term, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'term_id' })
  term?: Relation<Term>;
}
