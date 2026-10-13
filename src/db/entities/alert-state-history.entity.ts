import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { AlertStatus } from '../enums';
import { Alert } from './alert.entity';
import { User } from './user.entity';

/** Lịch sử chuyển trạng thái cảnh báo — append-only (docs/rules/11). */
@Entity('alert_state_history')
@Index(['alertId', 'changedAt'])
export class AlertStateHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  alertId!: string;

  /** NULL khi tạo mới. */
  @Column({ type: 'enum', enum: AlertStatus, enumName: 'alert_status', nullable: true })
  fromStatus!: AlertStatus | null;

  @Column({ type: 'enum', enum: AlertStatus, enumName: 'alert_status' })
  toStatus!: AlertStatus;

  /** NULL khi do hệ thống (tạo, mở lại, không còn hiệu lực sau hoàn tác). */
  @Column({ type: 'varchar', length: 20, nullable: true })
  changedBy!: string | null;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @Column({ type: 'timestamptz' })
  changedAt!: Date;

  @ManyToOne(() => Alert, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'alert_id' })
  alert?: Relation<Alert>;

  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'changed_by' })
  changer?: Relation<User> | null;
}
