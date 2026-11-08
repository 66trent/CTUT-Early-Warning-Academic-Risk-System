/** Lỗi cả file → lô `REJECTED` với lời giải thích cho người dùng (docs/rules/12). */
export class FileRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileRejectedError';
  }
}

/** Giới hạn file (docs/rules/12). */
export const IMPORT_LIMITS = {
  maxUploadBytes: 20 * 1024 * 1024,
  /** Tổng số dòng dữ liệu của cả lô (mọi file). */
  maxDataRows: 50_000,
  /** Số file tối đa của 1 lô (Phase 8f — người dùng chốt 2026-10-20). */
  maxFilesPerBatch: 50,
  maxXlsxUncompressedBytes: 100 * 1024 * 1024,
} as const;
