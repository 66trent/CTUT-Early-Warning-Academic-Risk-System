/** Lỗi nghiệp vụ có mã — Server Action chuyển thành `{ ok: false, code, message }`. */
export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/** Không có quyền với tài nguyên. Thông báo chung, không lộ tài nguyên có tồn tại hay không. */
export class ForbiddenError extends AppError {
  constructor(message = 'Bạn không có quyền thực hiện thao tác này.') {
    super('FORBIDDEN', message);
    this.name = 'ForbiddenError';
  }
}

export type ActionResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

/** Chuyển lỗi thành kết quả thuần cho Client Component; lỗi lạ không lộ chi tiết. */
export function toActionError(error: unknown): { ok: false; code: string; message: string } {
  if (error instanceof AppError) return { ok: false, code: error.code, message: error.message };
  return { ok: false, code: 'INTERNAL_ERROR', message: 'Đã có lỗi xảy ra, vui lòng thử lại.' };
}
