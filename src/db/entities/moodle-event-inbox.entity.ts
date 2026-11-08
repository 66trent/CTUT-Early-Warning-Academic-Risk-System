import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import { type MoodleEventOutcome } from '../enums';

/**
 * Sự kiện plugin `local_ewars` gửi sang (Phase 10c — docs/tich-hop-moodle.md 4b). `eventId` do plugin
 * sinh → nhận trùng (Moodle thử lại) bị bỏ qua. Chỉ là "chuông báo": EWARS không tin nội dung, luôn
 * gọi lại web service lấy dữ liệu. Không chứa họ tên / điểm.
 */
@Entity('moodle_event_inbox')
@Index(['receivedAt'])
export class MoodleEventInbox {
  @PrimaryColumn({ type: 'uuid' })
  eventId!: string;

  /** Tên lớp sự kiện Moodle, VD `\mod_quiz\event\attempt_submitted`. */
  @Column({ type: 'varchar', length: 120 })
  eventName!: string;

  @Column({ type: 'int' })
  moodleCourseId!: number;

  @Column({ type: 'int', nullable: true })
  objectId!: number | null;

  /** Thời điểm sự kiện xảy ra trên Moodle. */
  @Column({ type: 'timestamptz' })
  occurredAt!: Date;

  @Column({ type: 'varchar', length: 20 })
  outcome!: MoodleEventOutcome;

  @CreateDateColumn({ type: 'timestamptz' })
  receivedAt!: Date;
}
