import { Column, Entity, PrimaryColumn } from 'typeorm';
import { RuleGroup, RuleStatus } from '../enums';

/**
 * Định danh 1 luật nghiệp vụ (docs/rules/11) — KHÔNG chứa ngưỡng (ngưỡng ở `RuleVersion`).
 * `RISK-SCORE` là Rule đặc biệt chứa trọng số + tham số dữ liệu chung, không tạo cảnh báo.
 */
@Entity('rules')
export class Rule {
  /** VD `ATT-01` — giữ nguyên định dạng `NHÓM-số` (docs/rules/02). */
  @PrimaryColumn({ type: 'varchar', length: 20 })
  ruleCode!: string;

  @Column({ type: 'varchar', length: 100 })
  ruleName!: string;

  @Column({ type: 'enum', enum: RuleGroup, enumName: 'rule_group' })
  ruleGroup!: RuleGroup;

  /** `PER_COURSE` / `PER_STUDENT` — kiểu TS `RuleScope`. */
  @Column({ type: 'varchar', length: 30 })
  scope!: string;

  @Column({ type: 'int' })
  priority!: number;

  /** Số GIỜ trước khi cho tạo Alert mới cùng khóa tương quan (dùng ở Phase 5). */
  @Column({ type: 'int' })
  cooldown!: number;

  @Column({ type: 'enum', enum: RuleStatus, enumName: 'rule_status' })
  status!: RuleStatus;
}
