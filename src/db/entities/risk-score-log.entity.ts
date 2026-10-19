import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { DataCompletenessLevel, DataStatus } from '../enums';
import { EvaluationRun } from './evaluation-run.entity';
import { RuleVersion } from './rule-version.entity';
import { Student } from './student.entity';
import { Term } from './term.entity';

/** 1 nhóm chỉ số dùng khi tính (docs/rules/08) — giá trị thô và đã chuẩn hóa [0, 1]. */
export interface RiskComponent {
  group: 'ATTENDANCE' | 'LMS' | 'ACADEMIC';
  status: DataStatus;
  weight: number;
  /** Tỷ lệ vắng / tỷ lệ bỏ bài / điểm trung bình; NULL khi nhóm không AVAILABLE. */
  rawValue: number | null;
  normalized: number | null;
  /** Nhóm học lực: ĐTB của học kỳ này hay học kỳ liền trước (docs/rules/08). */
  basis?: 'CURRENT_TERM' | 'PREVIOUS_TERM';
}

/**
 * Điểm rủi ro tổng hợp của 1 sinh viên trong 1 học kỳ tại 1 lần chạy (docs/rules/11).
 * CHỈ để hiển thị/sắp xếp — không tạo cảnh báo. `riskScoreValue` NULL khi INSUFFICIENT.
 */
@Entity('risk_score_logs')
@Index(['studentId', 'termId', 'calculatedAt'])
@Index(['evaluationRunId'])
export class RiskScoreLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 20 })
  studentId!: string;

  @Column({ type: 'varchar', length: 10 })
  termId!: string;

  @Column({ type: 'double precision', nullable: true })
  riskScoreValue!: number | null;

  @Column({
    type: 'enum',
    enum: DataCompletenessLevel,
    enumName: 'data_completeness_level',
  })
  dataCompletenessLevel!: DataCompletenessLevel;

  /** Validate Zod trước khi ghi. */
  @Column({ type: 'jsonb' })
  componentsUsed!: RiskComponent[];

  /** Phiên bản cấu hình `RISK-SCORE` (trọng số) đã dùng. */
  @Column({ type: 'uuid' })
  ruleVersionId!: string;

  /** Lần chạy tạo ra bản ghi — chạy lại job xóa và ghi lại theo lần chạy (idempotent). */
  @Column({ type: 'uuid' })
  evaluationRunId!: string;

  @Column({ type: 'timestamptz' })
  calculatedAt!: Date;

  @ManyToOne(() => Student, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'student_id' })
  student?: Relation<Student>;

  @ManyToOne(() => Term, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'term_id' })
  term?: Relation<Term>;

  @ManyToOne(() => RuleVersion, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'rule_version_id' })
  ruleVersion?: Relation<RuleVersion>;

  @ManyToOne(() => EvaluationRun, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'evaluation_run_id' })
  evaluationRun?: Relation<EvaluationRun>;
}
