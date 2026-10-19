import { z } from 'zod';

/** Mã Rule cấu hình chung — trọng số RiskScore + tham số dữ liệu dùng chung (docs/rules/08). */
export const RISK_SCORE_RULE_CODE = 'RISK-SCORE';

const weight = z.number().min(0).max(100);

/** Điểm hệ 4 bội số 0,1 (VD A = 3,8) — kiểm tra bằng số nguyên phần mười, không `multipleOf`. */
const gradePoint = z
  .number()
  .min(0)
  .max(4)
  .refine((v) => Math.abs(v * 10 - Math.round(v * 10)) < 1e-9, {
    message: 'Điểm hệ 4 có tối đa 1 chữ số thập phân.',
  });

/**
 * `condition` của `RISK-SCORE`. Tham số dữ liệu dùng chung cho NHIỀU luật đặt ở đây (một nguồn):
 * độ mới điểm danh, "đến hạn" của bài trắc nghiệm không có hạn nộp, thang quy đổi điểm chữ.
 */
export const riskScoreConfigSchema = z
  .object({
    weights: z.object({ attendance: weight, lms: weight, academic: weight }),
    attendance: z.object({
      /** Snapshot cũ hơn số ngày này → STALE (không chạy ATT-*). */
      freshnessDays: z.number().int().min(1).max(365),
      countExcused: z.boolean(),
      /** Tỷ lệ vắng ứng với rủi ro tối đa (= ngưỡng cấm thi 20%). */
      normalizer: z.number().gt(0).max(1),
    }),
    lms: z.object({
      /** Bài trắc nghiệm không có hạn nộp: tỷ lệ sinh viên của lớp đã nộp để coi là đến hạn. */
      participationThreshold: z.number().gt(0).max(1),
      /** Số ngày kể từ lượt làm đầu tiên của lớp. */
      graceDays: z.number().int().min(0).max(60),
    }),
    academic: z.object({
      /** Quy đổi điểm chữ → hệ 4 theo Quy chế 336 (docs/rules/08). */
      gradeScale: z.record(z.string().min(1).max(2), gradePoint),
      /** ĐTB từ mức này trở lên → rủi ro học lực 0. */
      safeGpa: z.number().gt(0).max(4),
    }),
  })
  .refine((c) => c.weights.attendance + c.weights.lms + c.weights.academic > 0, {
    message: 'Tổng trọng số phải lớn hơn 0.',
  });

export type RiskScoreConfig = z.infer<typeof riskScoreConfigSchema>;

/** Thang quy đổi theo Quy chế đào tạo 336/QĐ-ĐHKTCN: A = 3,8 (người dùng chốt 2026-10-18). */
export const DEFAULT_GRADE_SCALE: Record<string, number> = {
  'A+': 4,
  A: 3.8,
  'B+': 3.5,
  B: 3,
  'C+': 2.5,
  C: 2,
  'D+': 1.5,
  D: 1,
  F: 0,
};

export const DEFAULT_RISK_SCORE_CONFIG: RiskScoreConfig = {
  weights: { attendance: 0.4, lms: 0.3, academic: 0.3 },
  attendance: { freshnessDays: 14, countExcused: true, normalizer: 0.2 },
  lms: { participationThreshold: 0.5, graceDays: 3 },
  academic: { gradeScale: DEFAULT_GRADE_SCALE, safeGpa: 2 },
};
