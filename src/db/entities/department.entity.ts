import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Khoa — danh mục chính thức nạp bằng seed, Admin chỉ xem (docs/rules/09). */
@Entity('departments')
export class Department {
  @PrimaryColumn({ type: 'varchar', length: 10 })
  departmentId!: string;

  @Column({ type: 'varchar', length: 150 })
  departmentName!: string;
}
