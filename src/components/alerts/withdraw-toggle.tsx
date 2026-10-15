'use client';

import { ConfirmActionButton } from '@/components/confirm-action-button';
import { setEnrollmentWithdrawnAction } from '@/modules/admin/actions/enrollment.actions';

/** Admin đánh dấu / bỏ đánh dấu rút học phần — xác nhận 2 lần, ghi nhật ký (docs/rules/09). */
export function WithdrawToggle({
  studentId,
  enrollmentId,
  courseLabel,
  withdrawn,
}: {
  studentId: string;
  enrollmentId: string;
  courseLabel: string;
  withdrawn: boolean;
}) {
  return withdrawn ? (
    <ConfirmActionButton
      trigger="Bỏ đánh dấu rút"
      triggerVariant="ghost"
      title={`Bỏ đánh dấu rút học phần ${courseLabel}?`}
      description="Học phần được xét lại ở lần chạy đánh giá kế tiếp."
      confirmLabel="Bỏ đánh dấu"
      successMessage="Đã bỏ đánh dấu rút học phần."
      onConfirm={() => setEnrollmentWithdrawnAction({ studentId, enrollmentId, withdrawn: false })}
    />
  ) : (
    <ConfirmActionButton
      trigger="Đánh dấu đã rút"
      triggerVariant="ghost"
      title={`Đánh dấu sinh viên đã rút học phần ${courseLabel}?`}
      description="Từ lần chạy đánh giá kế tiếp, hệ thống bỏ qua mọi luật của học phần này. Cảnh báo hiện có không đổi ngay. Bỏ đánh dấu được nếu nhầm."
      confirmLabel="Đánh dấu đã rút"
      successMessage="Đã đánh dấu rút học phần."
      onConfirm={() => setEnrollmentWithdrawnAction({ studentId, enrollmentId, withdrawn: true })}
    />
  );
}
