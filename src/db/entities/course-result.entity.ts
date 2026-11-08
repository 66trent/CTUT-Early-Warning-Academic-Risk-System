import {
  Column,
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
 * Kết quả 1 học phần ĐÃ KHÓA ĐIỂM của 1 sinh viên trong 1 học kỳ (docs/rules/10). 1 kết quả / Enrollment.
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

  /** Điểm thường xuyên, thang 10 — chỉ hiển thị. */
  @Column({ type: 'double precision', nullable: true })
  processScore!: number | null;

  /** Điểm cuối kỳ, thang 10 — chỉ hiển thị. */
  @Column({ type: 'double precision', nullable: true })
  examScore!: number | null;

  /** Thang 9 mức: A+, A, B+, B, C+, C, D+, D, F (Quy chế 336). */
  @Column({ type: 'varchar', length: 2 })
  letterGrade!: string;

  /** `letterGrade != 'F'`. */
  @Column({ type: 'boolean' })
  passed!: boolean;

  /** `duoc_du_thi` — false = bị cấm thi. NULL khi file không có cột. */
  @Column({ type: 'boolean', nullable: true })
  eligibleForExam!: boolean | null;

  /** `vang_thi`. NULL khi file không có cột. */
  @Column({ type: 'boolean', nullable: true })
  absentFromExam!: boolean | null;

  /** Lô cập nhật gần nhất. */
  @Column({ type: 'uuid' })
  importBatchId!: string;

  /** Ngày công bố điểm (`ngay_cong_bo`), trống thì = lúc nạp. Dùng cho mốc asOf. */
  @Column({ type: 'timestamptz' })
  publishedAt!: Date;

  @Column({ type: 'timestamptz' })
  importedAt!: Date;

  @ManyToOne(() => Enrollment, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'enrollment_id' })
  enrollment?: Relation<Enrollment>;

  @ManyToOne(() => ImportBatch, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'import_batch_id' })
  importBatch?: Relation<ImportBatch>;
}
