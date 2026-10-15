import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Học kỳ (docs/rules/09). Tối đa 1 học kỳ hiện tại — partial unique index.
 * Học kỳ đã chốt (`closedAt`) không nhận thêm dữ liệu điểm danh/LMS.
 */
@Entity('terms')
@Index('UQ_terms_single_current', ['isCurrent'], { unique: true, where: '"is_current" = true' })
export class Term {
  /** VD: HK1_2026 = Học kỳ 1 năm học 2026–2027. */
  @PrimaryColumn({ type: 'varchar', length: 10 })
  termId!: string;

  @Column({ type: 'varchar', length: 50 })
  termName!: string;

  @Column({ type: 'varchar', length: 10 })
  academicYear!: string;

  @Column({ type: 'timestamptz' })
  startDate!: Date;

  @Column({ type: 'timestamptz' })
  endDate!: Date;

  @Column({ type: 'boolean', default: false })
  isCurrent!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  closedAt!: Date | null;
}
