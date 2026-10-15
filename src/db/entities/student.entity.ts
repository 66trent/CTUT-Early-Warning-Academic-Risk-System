import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import { OfficialAcademicStatus } from '../enums';
import { AdministrativeClass } from './administrative-class.entity';
import { User } from './user.entity';

/**
 * Hồ sơ sinh viên (docs/rules/09). Khoa, khóa, CVHT suy ra từ lớp — không lưu lặp.
 * `studentId` = `User.userId` của tài khoản sinh viên (khóa ngoại tới users).
 */
@Entity('students')
export class Student {
  @PrimaryColumn({ type: 'varchar', length: 20 })
  studentId!: string;

  @Column({ type: 'varchar', length: 100 })
  fullName!: string;

  @Index()
  @Column({ type: 'varchar', length: 20 })
  classId!: string;

  /** Bản sao chỉ-đọc từ SIS — CHỈ tiến trình nhập sinh viên (data-import) được ghi. */
  @Column({
    type: 'enum',
    enum: OfficialAcademicStatus,
    enumName: 'official_academic_status',
  })
  officialAcademicStatus!: OfficialAcademicStatus;

  @ManyToOne(() => AdministrativeClass, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'class_id' })
  administrativeClass?: Relation<AdministrativeClass>;

  @OneToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'student_id', referencedColumnName: 'userId' })
  user?: Relation<User>;
}
