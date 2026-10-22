import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import { Department } from './department.entity';

/**
 * Ngành (docs/rules/09, Phase 9a) — gom lớp nhiều khóa cùng ngành (VD `HTTT2411`, `HTTT2511`) để
 * lọc / thống kê theo ngành. Danh mục nạp bằng seed, Admin chỉ xem.
 */
@Entity('majors')
export class Major {
  /** Mã ngắn, VD `KTPM` (không dùng mã ngành của Bộ GD). */
  @PrimaryColumn({ type: 'varchar', length: 10 })
  majorId!: string;

  @Column({ type: 'varchar', length: 150 })
  majorName!: string;

  @Index()
  @Column({ type: 'varchar', length: 10 })
  departmentId!: string;

  @ManyToOne(() => Department, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'department_id' })
  department?: Relation<Department>;
}
