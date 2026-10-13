import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { ConfidentialityLevel, InterventionType } from '../enums';
import { Alert } from './alert.entity';
import { User } from './user.entity';

/**
 * 1 hành động can thiệp của Cố vấn học tập (docs/rules/11). Nội dung SENSITIVE chỉ hiển thị
 * cho Cố vấn học tập phụ trách trực tiếp — Admin và người khác thấy "nội dung bảo mật" (docs/rules/04).
 */
@Entity('interventions')
@Index(['alertId', 'performedAt'])
export class Intervention {
  @PrimaryGeneratedColumn('uuid')
  interventionId!: string;

  @Column({ type: 'uuid' })
  alertId!: string;

  @Column({ type: 'varchar', length: 20 })
  performedBy!: string;

  @Column({ type: 'enum', enum: InterventionType, enumName: 'intervention_type' })
  type!: InterventionType;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'timestamptz' })
  performedAt!: Date;

  @Column({ type: 'text', nullable: true })
  outcome!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  nextFollowUpAt!: Date | null;

  /** Kiểu TS `InterventionStatus` (DONE / FOLLOW_UP) — varchar + Zod. */
  @Column({ type: 'varchar', length: 20 })
  status!: string;

  @Column({
    type: 'enum',
    enum: ConfidentialityLevel,
    enumName: 'confidentiality_level',
  })
  confidentialityLevel!: ConfidentialityLevel;

  @ManyToOne(() => Alert, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'alert_id' })
  alert?: Relation<Alert>;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'performed_by' })
  performer?: Relation<User>;
}
