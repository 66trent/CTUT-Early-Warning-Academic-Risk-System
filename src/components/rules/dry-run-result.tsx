import { SeverityBadge } from '@/components/domain/severity-badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SEVERITY_ORDER } from '@/db/enums';
import { formatVnDateTime } from '@/lib/dates';
import { SEVERITY_LABELS } from '@/lib/labels';
import type {
  DryRunResultDto,
  DryRunSide,
  DryRunStudentDto,
} from '@/modules/rule-engine/services/dry-run.service';

const fmtRisk = (v: number | null) => (v === null ? '—' : v.toFixed(2).replace('.', ','));

function SideCell({ side }: { side: DryRunSide }) {
  const parts = [...SEVERITY_ORDER]
    .reverse()
    .filter((s) => side.bySeverity[s])
    .map((s) => `${SEVERITY_LABELS[s]} ${side.bySeverity[s]}`);
  return (
    <>
      <span className="text-lg font-semibold tabular-nums">{side.students}</span> sinh viên
      <span className="block text-xs text-muted-foreground">
        {side.triggers} dấu hiệu{parts.length > 0 ? ` · ${parts.join(' · ')}` : ''}
      </span>
    </>
  );
}

function StudentList({
  title,
  items,
  total,
}: {
  title: string;
  items: DryRunStudentDto[];
  total: number;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">
        {title} ({total})
      </h3>
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">Không có.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sinh viên</TableHead>
                <TableHead>Lớp</TableHead>
                <TableHead>Mức</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((s) => (
                <TableRow key={s.studentId} className="even:bg-muted">
                  <TableCell>
                    <span className="font-medium">{s.fullName}</span>
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {s.studentId}
                    </span>
                  </TableCell>
                  <TableCell className="tabular-nums">{s.classId}</TableCell>
                  <TableCell>
                    <SeverityBadge severity={s.severity} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {total > items.length && (
            <p className="border-t px-3 py-2 text-xs text-muted-foreground">
              Hiển thị {items.length}/{total} sinh viên đầu tiên.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Kết quả chạy thử: bản đang áp dụng so với bản nháp, kèm danh sách sinh viên thêm/bớt. */
export function DryRunResult({ result }: { result: DryRunResultDto }) {
  const delta = result.proposed.students - result.current.students;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Đã xét {result.studentsEvaluated} sinh viên của học kỳ {result.termId}, mốc dữ liệu{' '}
        {formatVnDateTime(result.asOf)}. Chạy thử không tạo cảnh báo, không gửi thông báo.
      </p>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead />
              <TableHead>Bản đang áp dụng</TableHead>
              <TableHead>Bản nháp v{result.version}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Sinh viên có dấu hiệu</TableCell>
              <TableCell>
                <SideCell side={result.current} />
              </TableCell>
              <TableCell>
                <SideCell side={result.proposed} />
                <span className="block text-xs font-medium">
                  {delta === 0 ? 'Không đổi' : delta > 0 ? `Tăng ${delta}` : `Giảm ${-delta}`}
                </span>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Điểm rủi ro trung bình</TableCell>
              <TableCell className="tabular-nums">{fmtRisk(result.current.averageRisk)}</TableCell>
              <TableCell className="tabular-nums">{fmtRisk(result.proposed.averageRisk)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <StudentList title="Sinh viên thêm vào" items={result.added} total={result.addedCount} />
        <StudentList
          title="Sinh viên không còn"
          items={result.removed}
          total={result.removedCount}
        />
      </div>
    </div>
  );
}
