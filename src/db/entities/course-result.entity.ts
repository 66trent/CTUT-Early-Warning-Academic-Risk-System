import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { CourseResultStatus } from '../enums';
import { Enrollment } from './enrollment.entity';
import { ImportBatch } from './import-batch.entity';

/**
 * Kết quả 1 học phần của 1 sinh viên trong 1 học kỳ (docs/rules/10). 1 kết quả / Enrollment.
 * KHÔNG lưu điểm hệ 4 — rule-engine quy đổi từ `letterGrade` lúc đánh giá.
 */
@Entity('course_results')
@Index(['enrollmentId'], { unique: true })
@Index(['importBatchId'])
export class CourseResult {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  enrollmentId!: string;

  @Column({ type: 'double precision', nullable: true })
  processScore!: number | null;

  @Column({ type: 'double precision', nullable: true })
  examScore!: number | null;

  @Column({ type: 'double precision', nullable: true })
  finalScore!: number | null;

  /** Thang 9 mức: A+, A, B+, B, C+, C, D+, D, F. */
  @Column({ type: 'varchar', length: 2, nullable: true })
  letterGrade!: string | null;

  /** NULL khi chưa có kết quả cuối kỳ. */
  @Column({ type: 'boolean', nullable: true })
  passed!: boolean | null;

  @Column({ type: 'enum', enum: CourseResultStatus, enumName: 'course_result_status' })
  resultStatus!: CourseResultStatus;

  /** Lô cập nhật gần nhất. */
  @Column({ type: 'uuid' })
  importBatchId!: string;

  /** Ngày công bố điểm (`ngay_cong_bo`), trống thì = lúc nạp. Dùng cho mốc asOf. */
  @Column({ type: 'timestamptz' })
  publishedAt!: Date;

  @Column({ type: 'timestamptz' })
  importedAt!: Date;

  /**
   * Ngày công bố điểm quá trình (lần nạp PROCESS_ONLY) — GIỮ LẠI khi kết quả chuyển FINAL, để
   * chạy lại đánh giá ở mốc giữa kỳ vẫn thấy điểm quá trình (chống rò rỉ thời gian, docs/rules/08).
   */
  @Column({ type: 'timestamptz', nullable: true })
  processPublishedAt!: Date | null;

  @ManyToOne(() => Enrollment, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'enrollment_id' })
  enrollment?: Relation<Enrollment>;

  @ManyToOne(() => ImportBatch, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'import_batch_id' })
  importBatch?: Relation<ImportBatch>;
}
