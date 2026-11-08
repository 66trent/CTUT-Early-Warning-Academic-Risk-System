import { UserRole } from '@/db/enums';
import { writeAuditLog } from '@/lib/audit';
import { formatVnDateTime, toVnIsoDate } from '@/lib/dates';
import { ALERT_STATUS_LABELS, SEVERITY_LABELS } from '@/lib/labels';
import { firstPage } from '@/lib/list-params';
import { type SheetRow, toCsv, toXlsx } from '@/lib/spreadsheet';
import {
  type AlertExtraFilter,
  type AlertListItemDto,
  type AlertSortKey,
  listAdminAlerts,
  listAdvisorAlerts,
} from './alert-query.service';

/** Trần số dòng 1 file xuất — đủ cho 1 học kỳ toàn trường ở quy mô đồ án (docs/rules/05). */
export const EXPORT_MAX_ROWS = 10_000;

export type ExportFormat = 'xlsx' | 'csv';

/** Phạm vi xuất — CVHT luôn chỉ lớp mình (lọc ở service theo lớp, docs/rules/06). */
export type ExportScope =
  | { role: UserRole.ADVISOR; userId: string; view: 'TODO' | 'ALL' }
  | {
      role: UserRole.ADMIN;
      userId: string;
      departmentId: string | null;
      majorId?: string | null;
      noAdvisor: boolean;
    };

export interface AlertExportFile {
  body: Buffer | string;
  fileName: string;
  contentType: string;
  rows: number;
}

const EXPORT_HEADERS = [
  'STT',
  'MSSV',
  'Họ tên',
  'Lớp',
  'Học kỳ',
  'Mức',
  'Trạng thái',
  'Lý do chính',
  'Số dấu hiệu',
  'Quá hạn chưa xác nhận',
  'Cập nhật lần cuối',
] as const;
const ADVISOR_HEADER = 'Cố vấn học tập';

/**
 * Cột xuất — KHÔNG có `inputSnapshot` thô hay nội dung can thiệp (docs/rules/04, 06); "Lý do" là
 * câu do hệ thống sinh từ luật.
 */
function toRows(items: AlertListItemDto[], withAdvisor: boolean): SheetRow[] {
  return items.map((a, i) => ({
    STT: i + 1,
    MSSV: a.studentId,
    'Họ tên': a.studentName,
    Lớp: a.classId,
    'Học kỳ': a.termName,
    Mức: SEVERITY_LABELS[a.severity],
    'Trạng thái': ALERT_STATUS_LABELS[a.status],
    'Lý do chính': a.summary,
    'Số dấu hiệu': a.signalCount,
    'Quá hạn chưa xác nhận': a.overdue ? 'Có' : 'Không',
    'Cập nhật lần cuối': formatVnDateTime(a.lastDetectedAt),
    ...(withAdvisor ? { [ADVISOR_HEADER]: a.advisorName ?? 'Chưa có' } : {}),
  }));
}

/** Danh sách cảnh báo theo bộ lọc đang chọn → file `.xlsx` / CSV; ghi Audit Log `ALERT_EXPORT`. */
export async function exportAlerts(
  scope: ExportScope,
  termId: string,
  extra: AlertExtraFilter,
  format: ExportFormat,
): Promise<AlertExportFile> {
  const list = firstPage<AlertSortKey>({ size: EXPORT_MAX_ROWS });
  const page =
    scope.role === UserRole.ADVISOR
      ? await listAdvisorAlerts(scope.userId, termId, scope.view, extra, list)
      : await listAdminAlerts(
          termId,
          scope.noAdvisor ? 'NO_ADVISOR' : 'ALL',
          { departmentId: scope.departmentId, majorId: scope.majorId ?? null },
          list,
          extra,
        );
  const rows = toRows(page.items, scope.role === UserRole.ADMIN);
  const headers =
    scope.role === UserRole.ADMIN ? [...EXPORT_HEADERS, ADVISOR_HEADER] : EXPORT_HEADERS;
  await writeAuditLog({
    actorId: scope.userId,
    action: 'ALERT_EXPORT',
    targetType: 'Term',
    targetId: termId,
    detail: { format, rows: rows.length, truncated: page.total > rows.length, ...extra },
  });
  const base = `canh-bao_${termId}_${toVnIsoDate(new Date()).replace(/-/g, '')}`;
  return format === 'csv'
    ? {
        body: toCsv(headers, rows),
        fileName: `${base}.csv`,
        contentType: 'text/csv; charset=utf-8',
        rows: rows.length,
      }
    : {
        body: await toXlsx('Cảnh báo', headers, rows),
        fileName: `${base}.xlsx`,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        rows: rows.length,
      };
}
