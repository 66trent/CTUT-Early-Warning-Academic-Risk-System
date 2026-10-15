import { EvaluationRunStatus, EvaluationTrigger } from '@/db/enums';

/** Lời văn cho người dùng — không hiện mã kỹ thuật trên giao diện (docs/rules/07). Dùng được ở client. */
export const RUN_STATUS_LABELS: Record<EvaluationRunStatus, string> = {
  [EvaluationRunStatus.QUEUED]: 'Đang chờ',
  [EvaluationRunStatus.RUNNING]: 'Đang chạy',
  [EvaluationRunStatus.COMPLETED]: 'Hoàn tất',
  [EvaluationRunStatus.FAILED]: 'Lỗi',
};

export const RUN_TRIGGER_LABELS: Record<EvaluationTrigger, string> = {
  [EvaluationTrigger.AUTO_AFTER_IMPORT]: 'Tự động sau khi nạp',
  [EvaluationTrigger.MANUAL]: 'Admin chạy',
};
