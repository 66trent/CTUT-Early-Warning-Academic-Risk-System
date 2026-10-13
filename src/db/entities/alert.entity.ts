import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { AlertStatus, Severity } from '../enums';
import { RiskScoreLog } from './risk-score-log.entity';
import { Student } from './student.entity';
import { Term } from './term.entity';
import { User } from './user.entity';

/**
 * Hồ sơ cảnh báo — 1 / sinh viên / học kỳ, gộp mọi trigger (docs/rules/08, 11).
 * Tối đa 1 cảnh báo chưa INVALIDATED / (sinh viên, học kỳ) — partial unique index.
 * LUÔN chỉ mang tính tham khảo (`isReferenceOnly = true`, CHECK ở DB).
 */
@Entity('alerts')
@Index(['studentId', 'termId', 'status'])
@Index('UQ_alerts_student_term_active', ['studentId', 'termId'], {
  unique: true,
  where: `"status" <> 'INVALIDATED'`,
})
@Check('CHK_alerts_reference_only', '"is_reference_only" = true')
export class Alert {
  @PrimaryGeneratedColumn('uuid')
  alertId!: string;

  @Column({ type: 'varchar', length: 20 })
  studentId!: string;

  @Column({ type: 'varchar', length: 10 })
  termId!: string;

  /** = max severity các trigger của lần chạy gần nhất đã áp dụng. */
  @Column({ type: 'enum', enum: Severity, enumName: 'severity' })
  severity!: Severity;

  @Column({ type: 'enum', enum: AlertStatus, enumName: 'alert_status' })
  status!: AlertStatus;

  @Column({ type: 'timestamptz' })
  firstDetectedAt!: Date;

  @Column({ type: 'timestamptz' })
  lastDetectedAt!: Date;

  /** Mốc asOf mới nhất đã áp dụng — lần chạy mốc cũ hơn chỉ thêm bằng chứng. */
  @Column({ type: 'timestamptz' })
  lastAsOf!: Date;

  /** Lần chạy gần nhất ĐÃ ÁP DỤNG (đổi mức/trạng thái) — trigger của lần này = dấu hiệu hiện tại. */
  @Column({ type: 'uuid' })
  lastEvaluationRunId!: string;

  /** Lúc chuyển RESOLVED/DISMISSED gần nhất — tính cooldown (nếu bật). */
  @Column({ type: 'timestamptz', nullable: true })
  closedAt!: Date | null;

  /** Cố vấn học tập lúc tạo/chuyển (thông báo, lịch sử). Quyền luôn suy ra qua lớp. NULL = lớp chưa có. */
  @Column({ type: 'varchar', length: 20, nullable: true })
  assignedAdvisorId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  riskScoreLogId!: string | null;

  /** Bắt buộc khi DISMISSED / INVALIDATED. */
  @Column({ type: 'text', nullable: true })
  closedReason!: string | null;

  @Column({ type: 'boolean', default: true })
  isReferenceOnly!: boolean;

  @ManyToOne(() => Student, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'student_id' })
  student?: Relation<Student>;

  @ManyToOne(() => Term, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'term_id' })
  term?: Relation<Term>;

  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'assigned_advisor_id' })
  assignedAdvisor?: Relation<User> | null;

  @ManyToOne(() => RiskScoreLog, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'risk_score_log_id' })
  riskScoreLog?: Relation<RiskScoreLog> | null;
}
