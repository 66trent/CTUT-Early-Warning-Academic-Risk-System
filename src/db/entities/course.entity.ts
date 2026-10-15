import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Học phần (docs/rules/09). Tự tạo khi file nguồn nhắc tới mã chưa có — không quản lý
 * lớp học phần hay lịch học. `credits` điền từ file kết quả học phần.
 */
@Entity('courses')
export class Course {
  /** Mã học phần (`ma_hoc_phan`). */
  @PrimaryColumn({ type: 'varchar', length: 20 })
  courseId!: string;

  @Column({ type: 'varchar', length: 150 })
  courseName!: string;

  /** NULL → học phần không được tính vào ACA-03. */
  @Column({ type: 'int', nullable: true })
  credits!: number | null;

  /** Chỉ hiển thị, không dùng trong luật. */
  @Column({ type: 'int', nullable: true })
  theoryPeriods!: number | null;

  @Column({ type: 'int', nullable: true })
  practicePeriods!: number | null;
}
