import { z } from 'zod';

/** Mã Rule cấu hình chung — trọng số RiskScore + tham số dữ liệu dùng chung (docs/rules/08). */
export const RISK_SCORE_RULE_CODE = 'RISK-SCORE';

const weight = z.number().min(0).max(100);

/**
 * `condition` của `RISK-SCORE`. Tham số dữ liệu dùng chung cho NHIỀU luật đặt ở đây (một nguồn):
 * độ mới điểm danh, định nghĩa "bài đến hạn" của LMS, cách tính tỷ lệ vắng cho RiskScore.
 */
export const riskScoreConfigSchema = z
  .object({
    weights: z.object({ attendance: weight, lms: weight, academic: weight }),
    attendance: z.object({
      /** Snapshot cũ hơn số ngày này → STALE (không chạy ATT-*). */
      freshnessDays: z.number().int().min(1).max(365),
      denominator: z.enum(['PLANNED', 'HELD']),
      countExcused: z.boolean(),
      /** Tỷ lệ vắng ứng với rủi ro tối đa (= ngưỡng cấm thi 20%). */
      normalizer: z.number().gt(0).max(1),
    }),
    lms: z.object({
      /** Tỷ lệ sinh viên của nhóm đã nộp để coi bài là đến hạn. */
      participationThreshold: z.number().gt(0).max(1),
      /** Số ngày kể từ lượt làm đầu tiên của nhóm. */
      graceDays: z.number().int().min(0).max(60),
    }),
    academic: z.object({ passScore: z.number().gt(0).max(10) }),
  })
  .refine((c) => c.weights.attendance + c.weights.lms + c.weights.academic > 0, {
    message: 'Tổng trọng số phải lớn hơn 0.',
  });

export type RiskScoreConfig = z.infer<typeof riskScoreConfigSchema>;

export const DEFAULT_RISK_SCORE_CONFIG: RiskScoreConfig = {
  weights: { attendance: 0.4, lms: 0.3, academic: 0.3 },
  attendance: { freshnessDays: 14, denominator: 'PLANNED', countExcused: true, normalizer: 0.2 },
  lms: { participationThreshold: 0.5, graceDays: 3 },
  academic: { passScore: 5 },
};
