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
import { type MoodleSyncStatus, type MoodleSyncTrigger } from '../enums';
import { Term } from './term.entity';

/** Kết quả đọc 1 khóa học trong 1 lần đồng bộ (Zod: `moodleSyncStatsSchema`). */
export interface MoodleSyncCourseStats {
  linkId: string;
  sectionCode: string;
  courseId: string;
  /** Số dòng sinh ra theo loại (trước kiểm tra). */
  rows: { attendance: number; quiz: number; assignment: number };
  unknownStudents: number;
  /** Ghi chú không chặn (VD bài thực hành không có hạn nộp bị bỏ qua). */
  notes: string[];
  error: string | null;
}

export interface MoodleSyncStats {
  courses: MoodleSyncCourseStats[];
  /** Loại dữ liệu → số file bỏ qua vì không đổi so với lô đã nạp. */
  unchangedFiles: Partial<Record<'ATTENDANCE_SUMMARY' | 'LMS_QUIZ' | 'LMS_ASSIGNMENT', number>>;
}

export type MoodleSyncBatchIds = Partial<
  Record<'ATTENDANCE_SUMMARY' | 'LMS_QUIZ' | 'LMS_ASSIGNMENT', string>
>;

/**
 * 1 lần đồng bộ Moodle (Phase 10b — docs/rules/12): đọc các khóa đã bật của 1 học kỳ → tối đa 3 lô
 * nhập nguồn `MOODLE` (điểm danh / trắc nghiệm / thực hành). Chạy tay: 3 lô chờ "Xác nhận nạp cả 3".
 */
@Entity('moodle_sync_runs')
@Index(['termId', 'createdAt'])
export class MoodleSyncRun {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 10 })
  termId!: string;

  /** `MANUAL` (Admin bấm Đồng bộ ngay); 10c thêm `EVENT` / `SCHEDULED` / `DUE_DATE`. */
  @Column({ type: 'varchar', length: 20 })
  trigger!: MoodleSyncTrigger;

  @Column({ type: 'varchar', length: 20 })
  requestedBy!: string;

  /** `QUEUED` → `RUNNING` → `STAGED` (đã tạo lô) / `NO_CHANGE` / `FAILED`. */
  @Column({ type: 'varchar', length: 20 })
  status!: MoodleSyncStatus;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  batchIds!: MoodleSyncBatchIds;

  @Column({ type: 'jsonb', nullable: true })
  stats!: MoodleSyncStats | null;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt!: Date | null;

  @ManyToOne(() => Term, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'term_id' })
  term?: Relation<Term>;
}
