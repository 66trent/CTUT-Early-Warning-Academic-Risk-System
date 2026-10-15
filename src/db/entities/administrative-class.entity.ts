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

  @Column({ type: 'varchar', length: 10 })
  cohortYear!: string;

  /** CVHT chủ nhiệm (User role ADVISOR, ACTIVE). NULL = chưa gán. */
  @Index()
  @Column({ type: 'varchar', length: 20, nullable: true })
  advisorId!: string | null;

  @ManyToOne(() => Department, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'department_id' })
  department?: Relation<Department>;

  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'advisor_id' })
  advisor?: Relation<User> | null;
}
