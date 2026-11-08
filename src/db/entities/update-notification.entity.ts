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
import { EvaluationRun } from './evaluation-run.entity';
import { User } from './user.entity';

/**
 * Thông báo chuông "dữ liệu vừa cập nhật / đánh giá đã cập nhật" (người dùng chốt 2026-11-08):
 * 1 thông báo / lần đánh giá xong / người nhận — Admin (mọi lần) + Cố vấn học tập lớp liên quan.
 * Khác `Notification` (gắn 1 cảnh báo, có email): chỉ trong ứng dụng, không có dữ liệu cá nhân.
 */
@Entity('update_notifications')
@Index(['evaluationRunId', 'recipientId'], { unique: true })
@Index(['recipientId', 'readAt'])
export class UpdateNotification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 20 })
  recipientId!: string;

  @Column({ type: 'uuid' })
  evaluationRunId!: string;

  @Column({ type: 'varchar', length: 10 })
  termId!: string;

  /** VD "Moodle: Điểm danh — Mạng máy tính vừa cập nhật". */
  @Column({ type: 'varchar', length: 200 })
  title!: string;

  /** VD "Đánh giá xong 20 sinh viên · 1 tăng mức" hoặc phần của lớp CVHT. */
  @Column({ type: 'varchar', length: 300 })
  body!: string;

  /** Đường dẫn trong ứng dụng khi bấm. */
  @Column({ type: 'varchar', length: 255 })
  link!: string;

  @Column({ type: 'timestamptz', nullable: true })
  readAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipient_id' })
  recipient?: Relation<User>;

  @ManyToOne(() => EvaluationRun, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'evaluation_run_id' })
  evaluationRun?: Relation<EvaluationRun>;
}
