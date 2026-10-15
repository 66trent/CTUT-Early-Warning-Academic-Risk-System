import { ImportBatchStatus, type ImportErrorReason } from '@/db/enums';

/** Lời văn cho người dùng — không hiện mã kỹ thuật trên giao diện (docs/rules/07). Dùng được ở client. */
export const ERROR_REASON_LABELS: Record<ImportErrorReason, string> = {
  INVALID_FORMAT: 'Sai định dạng dữ liệu',
  STUDENT_NOT_FOUND: 'Sinh viên chưa có trong danh sách',
  CLASS_NOT_FOUND: 'Lớp sinh hoạt chưa có trong hệ thống',
  DUPLICATE: 'Trùng dữ liệu',
  OUT_OF_RANGE: 'Giá trị ngoài phạm vi cho phép',
  TERM_MISMATCH: 'Không khớp học kỳ đã chọn',
  RESULT_ALREADY_FINAL: 'Kết quả đã có điểm cuối kỳ',
};

export function errorReasonLabel(reason: string): string {
  return ERROR_REASON_LABELS[reason as ImportErrorReason] ?? 'Dòng không hợp lệ';
}

export const BATCH_STATUS_LABELS: Record<ImportBatchStatus, string> = {
  [ImportBatchStatus.UPLOADING]: 'Đang tải lên',
  [ImportBatchStatus.VALIDATING]: 'Đang kiểm tra',
  [ImportBatchStatus.STAGED]: 'Chờ xác nhận',
  [ImportBatchStatus.LOADED]: 'Đang cập nhật',
  [ImportBatchStatus.RECONCILED]: 'Đã nạp',
  [ImportBatchStatus.REJECTED]: 'Bị từ chối',
  [ImportBatchStatus.DISCARDED]: 'Đã hủy',
  [ImportBatchStatus.ROLLED_BACK]: 'Đã hoàn tác',
};
