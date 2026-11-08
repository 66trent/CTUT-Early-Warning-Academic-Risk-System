import { toast as sonner } from 'sonner';

/** Lỗi cần đọc kỹ (VD lý do bị từ chối) — giữ lâu hơn thông báo thành công. */
const ERROR_DURATION_MS = 10_000;

/**
 * `toast` dùng chung cho mọi thao tác (docs/rules/07): giống `sonner`, riêng `toast.error` hiện
 * lâu hơn. Component import từ đây, không import thẳng `sonner`.
 */
export const toast: typeof sonner = Object.assign(
  (...args: Parameters<typeof sonner>) => sonner(...args),
  sonner,
  {
    error: ((message, data) =>
      sonner.error(message, { duration: ERROR_DURATION_MS, ...data })) as typeof sonner.error,
  },
);
