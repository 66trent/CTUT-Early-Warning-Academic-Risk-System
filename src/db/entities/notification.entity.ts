import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { NotificationChannel, NotificationStatus } from '../enums';
import { Alert } from './alert.entity';
import { User } from './user.entity';

/**
 * 1 lượt gửi thông báo gắn với 1 cảnh báo (docs/rules/11). Không chống gửi trùng theo tần suất
 * (người dùng bỏ) — chỉ chặn trùng khi job chạy lại: UNIQUE (cảnh báo, kênh, sự kiện, lần chạy).
 */
@Entity('notifications')
@Index(['alertId', 'createdAt'])
@Index(['recipientId', 'channel', 'readAt'])
@Index(['alertId', 'channel', 'event', 'evaluationRunId'], { unique: true })
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  notificationId!: string;

  @Column({ type: 'uuid' })
  alertId!: string;

  @Column({ type: 'varchar', length: 20 })
  recipientId!: string;

  @Column({ type: 'enum', enum: NotificationChannel, enumName: 'notification_channel' })
  channel!: NotificationChannel;

  @Column({ type: 'enum', enum: NotificationStatus, enumName: 'notification_status' })
  status!: NotificationStatus;

  /** Kiểu TS `NotificationEvent` (CREATED / REOPENED / SEVERITY_INCREASED) — varchar + Zod. */
  @Column({ type: 'varchar', length: 30 })
  event!: string;

  /** Lần chạy làm phát sinh sự kiện — khóa chống trùng khi job chạy lại. */
  @Column({ type: 'uuid' })
  evaluationRunId!: string;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt!: Date | null;

  /** Chỉ IN_APP: lúc người nhận đã xem. */
  @Column({ type: 'timestamptz', nullable: true })
  readAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => Alert, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'alert_id' })
  alert?: Relation<Alert>;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'recipient_id' })
  recipient?: Relation<User>;
}
