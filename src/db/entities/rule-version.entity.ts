import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { RuleStatus, Severity } from '../enums';
import { Rule } from './rule.entity';
import { User } from './user.entity';

/**
 * Phiên bản cụ thể của 1 luật (docs/rules/11). Sửa ngưỡng = tạo phiên bản mới, KHÔNG ghi đè.
 * Tối đa 1 phiên bản ACTIVE / luật (partial unique index). Chưa chạy thử → không kích hoạt được.
 */
@Entity('rule_versions')
@Index(['ruleCode', 'version'], { unique: true })
@Index('UQ_rule_versions_single_active', ['ruleCode'], {
  unique: true,
  where: `"status" = 'ACTIVE'`,
})
export class RuleVersion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 20 })
  ruleCode!: string;

  @Column({ type: 'int' })
  version!: number;

  /**
   * Ngưỡng/tham số — cấu trúc khác nhau theo luật, LUÔN validate bằng Zod của luật khi ghi và
   * khi đọc (`parseCondition`). Kiểu `object`: kiểu JSON đệ quy làm TypeORM báo lỗi kiểu.
   */
  @Column({ type: 'jsonb' })
  condition!: object;

  /** Luật nhiều mức: mức cao nhất luật có thể ra (chỉ hiển thị); các mức nằm trong `condition`. */
  @Column({ type: 'enum', enum: Severity, enumName: 'severity' })
  severity!: Severity;

  /** Hành động khi kích hoạt (VD kênh thông báo) — dùng ở Phase 5. */
  @Column({ type: 'jsonb' })
  action!: { channels: string[] };

  @Column({ type: 'timestamptz' })
  effectiveFrom!: Date;

  /** NULL = đang dùng. */
  @Column({ type: 'timestamptz', nullable: true })
  effectiveTo!: Date | null;

  @Column({ type: 'enum', enum: RuleStatus, enumName: 'rule_status' })
  status!: RuleStatus;

  @Column({ type: 'varchar', length: 20 })
  configuredBy!: string;

  /** Lần chạy thử gần nhất — NULL thì không được kích hoạt. */
  @Column({ type: 'timestamptz', nullable: true })
  lastDryRunAt!: Date | null;

  @ManyToOne(() => Rule, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'rule_code' })
  rule?: Relation<Rule>;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'configured_by' })
  configurer?: Relation<User>;
}
