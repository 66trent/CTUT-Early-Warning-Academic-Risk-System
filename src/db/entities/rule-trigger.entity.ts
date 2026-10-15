import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Severity } from '../enums';
import { type JsonPrimitive } from '../json';
import { EvaluationRun } from './evaluation-run.entity';
import { RuleVersion } from './rule-version.entity';
import { Rule } from './rule.entity';
import { Student } from './student.entity';
import { Term } from './term.entity';

/**
 * 1 bằng chứng: 1 lần 1 RuleVersion đúng với dữ liệu của 1 sinh viên (docs/rules/11).
 * Không hiển thị trực tiếp — là input tạo Alert. `alertId` NULL ở Phase 4, Phase 5 gắn Alert
 * (khóa ngoại tới bảng alerts thêm ở Phase 5).
 */
@Entity('rule_triggers')
@Index(['evaluationRunId'])
@Index(['studentId', 'termId'])
export class RuleTrigger {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  alertId!: string | null;

  @Column({ type: 'uuid' })
  evaluationRunId!: string;

  @Column({ type: 'varchar', length: 20 })
  ruleCode!: string;

  @Column({ type: 'uuid' })
  ruleVersionId!: string;

  @Column({ type: 'varchar', length: 20 })
  studentId!: string;

  /** `courseId` khi PER_COURSE, `studentId` khi PER_STUDENT. */
  @Column({ type: 'varchar', length: 20 })
  scopeId!: string;

  @Column({ type: 'varchar', length: 10 })
  termId!: string;

  @Column({ type: 'timestamptz' })
  triggeredAt!: Date;

  /** Số liệu thực tế dẫn đến kích hoạt (giải thích cho CVHT) — validate Zod trước khi ghi. */
  @Column({ type: 'jsonb' })
  inputSnapshot!: Record<string, JsonPrimitive>;

  /** Mô tả dễ hiểu cho CVHT. */
  @Column({ type: 'text' })
  reason!: string;

  @Column({ type: 'enum', enum: Severity, enumName: 'severity' })
  severity!: Severity;

  @ManyToOne(() => EvaluationRun, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'evaluation_run_id' })
  evaluationRun?: Relation<EvaluationRun>;

  @ManyToOne(() => Rule, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'rule_code' })
  rule?: Relation<Rule>;

  @ManyToOne(() => RuleVersion, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'rule_version_id' })
  ruleVersion?: Relation<RuleVersion>;

  @ManyToOne(() => Student, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'student_id' })
  student?: Relation<Student>;

  @ManyToOne(() => Term, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'term_id' })
  term?: Relation<Term>;
}
