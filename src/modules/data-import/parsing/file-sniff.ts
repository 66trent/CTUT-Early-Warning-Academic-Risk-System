import { FileRejectedError, IMPORT_LIMITS } from './errors';

export type ImportFileKind = 'csv' | 'xlsx';

const ZIP_LOCAL_HEADER = 0x04034b50;
const ZIP_EOCD = 0x06054b50;
const ZIP_CENTRAL_HEADER = 0x02014b50;

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot === -1 ? '' : fileName.slice(dot + 1).toLowerCase();
}

/**
 * Tổng dung lượng sau giải nén, đọc từ central directory của ZIP (không giải nén).
 * Chống zip bomb: file .xlsx nhỏ nhưng giải nén ra rất lớn.
 */
export function zipUncompressedSize(buffer: Buffer): number {
  const searchFrom = Math.max(0, buffer.length - 65_557);
  let eocd = -1;
  for (let i = buffer.length - 22; i >= searchFrom; i -= 1) {
    if (buffer.readUInt32LE(i) === ZIP_EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1)
    throw new FileRejectedError('File Excel bị hỏng hoặc không đúng định dạng .xlsx.');

  const entries = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  let total = 0;
  for (let i = 0; i < entries; i += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== ZIP_CENTRAL_HEADER) {
      throw new FileRejectedError('File Excel bị hỏng hoặc không đúng định dạng .xlsx.');
    }
    const size = buffer.readUInt32LE(offset + 24);
    // 0xFFFFFFFF = ZIP64 (file cực lớn) → coi như vượt giới hạn.
    total += size === 0xffffffff ? Number.POSITIVE_INFINITY : size;
    offset +=
      46 +
      buffer.readUInt16LE(offset + 28) +
      buffer.readUInt16LE(offset + 30) +
      buffer.readUInt16LE(offset + 32);
  }
  return total;
}

/**
 * Kiểm tra file tải lên theo đuôi + NỘI DUNG THẬT + dung lượng (docs/rules/06, 12).
 * Không dựa vào MIME trình duyệt gửi.
 */
export function sniffImportFile(fileName: string, data: Buffer): ImportFileKind {
  if (data.length === 0) throw new FileRejectedError('File rỗng.');
  if (data.length > IMPORT_LIMITS.maxUploadBytes) {
    throw new FileRejectedError('File vượt quá 20MB. Hãy tách thành nhiều file nhỏ hơn.');
  }

  const extension = extensionOf(fileName);
  if (extension === 'xlsx') {
    if (data.length < 4 || data.readUInt32LE(0) !== ZIP_LOCAL_HEADER) {
      throw new FileRejectedError('File có đuôi .xlsx nhưng nội dung không phải file Excel.');
    }
    if (zipUncompressedSize(data) > IMPORT_LIMITS.maxXlsxUncompressedBytes) {
      throw new FileRejectedError(
        'File Excel quá lớn sau khi giải nén. Hãy tách thành nhiều file.',
      );
    }
    return 'xlsx';
  }

  if (extension === 'csv') {
    if (data.includes(0)) {
      throw new FileRejectedError('File có đuôi .csv nhưng nội dung không phải văn bản.');
    }
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(data);
    } catch {
      throw new FileRejectedError(
        'File CSV không ở dạng UTF-8 nên sẽ lỗi dấu tiếng Việt. Trong Excel chọn Lưu thành → "CSV UTF-8 (Comma delimited)".',
      );
    }
    return 'csv';
  }

  throw new FileRejectedError('Chỉ nhận file .csv hoặc .xlsx.');
}
