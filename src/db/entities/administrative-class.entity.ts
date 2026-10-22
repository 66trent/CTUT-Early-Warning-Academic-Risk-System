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
import { Major } from './major.entity';
import { User } from './user.entity';

/** Lớp sinh hoạt — đơn vị gán Cố vấn học tập (docs/rules/09). */
@Entity('administrative_classes')
export class AdministrativeClass {
  @PrimaryColumn({ type: 'varchar', length: 20 })
  classId!: string;

  @Column({ type: 'varchar', length: 100 })
  className!: string;

  @Column({ type: 'varchar', length: 10 })
  departmentId!: string;

  /** Ngành (docs/rules/09, Phase 9a) — cùng khoa với lớp. NULL = khoa chưa có danh mục ngành. */
  @Index()
  @Column({ type: 'varchar', length: 10, nullable: true })
  majorId!: string | null;

  @Column({ type: 'varchar', length: 10 })
  cohortYear!: string;

  /** CVHT chủ nhiệm (User role ADVISOR, ACTIVE). NULL = chưa gán. */
  @Index()
  @Column({ type: 'varchar', length: 20, nullable: true })
  advisorId!: string | null;

  @ManyToOne(() => Department, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'department_id' })
  department?: Relation<Department>;

  @ManyToOne(() => Major, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'major_id' })
  major?: Relation<Major> | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'advisor_id' })
  advisor?: Relation<User> | null;
}
