'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { BookOpen, FileX, Loader2, Pencil, TriangleAlert, UserMinus, UserX } from 'lucide-react';
import { useState } from 'react';
import { ConfirmActionButton } from '@/components/confirm-action-button';
import { DataTable } from '@/components/data-table/data-table';
import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatVnDateTime } from '@/lib/dates';
import { toast } from '@/lib/notify';
import {
  setMoodleLinkAction,
  setMoodleSyncModeAction,
} from '@/modules/data-import/actions/moodle.actions';
import type { MoodleCourseRowDto } from '@/modules/data-import/services/moodle-link.service';

type Link = NonNullable<MoodleCourseRowDto['link']>;

function EditLinkDialog({
  termId,
  row,
  link,
}: {
  termId: string;
  row: MoodleCourseRowDto;
  link: Link;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [courseId, setCourseId] = useState(link.courseId);
  const [courseName, setCourseName] = useState(link.courseName);
  const [periods, setPeriods] = useState(link.totalPeriodsOverride?.toString() ?? '');

  async function save() {
    setPending(true);
    const result = await setMoodleLinkAction({
      termId,
      moodleCourseId: row.moodleCourseId,
      enabled: link.enabled,
      courseId,
      courseName,
      totalPeriodsOverride: periods.trim() === '' ? null : Number(periods),
    });
    setPending(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success('Đã lưu thông tin liên kết');
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={`Sửa liên kết ${row.fullname}`}>
          <Pencil aria-hidden />
          Sửa
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thông tin học phần — {link.sectionCode}</DialogTitle>
          <DialogDescription>
            Dùng khi tự tạo học phần trong EWARS. Mã học phần mặc định = mã lớp học phần bỏ 2 số
            cuối.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="moodle-course-id">Mã học phần</Label>
            <Input
              id="moodle-course-id"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="moodle-course-name">Tên học phần</Label>
            <Input
              id="moodle-course-name"
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="moodle-periods">
              Tổng số tiết (để trống = tính từ lịch buổi học trên Moodle)
            </Label>
            <Input
              id="moodle-periods"
              inputMode="numeric"
              value={periods}
              onChange={(e) => setPeriods(e.target.value.replace(/\D/g, ''))}
              placeholder="VD 45"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => void save()} disabled={pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Danh sách bật lên (popover) — sinh viên chưa có / đã rời khóa, bài đã xóa trên Moodle. */
function ListPopover({
  icon: Icon,
  label,
  note,
  items,
}: {
  icon: typeof UserX;
  label: string;
  note: string;
  items: { key: string; text: string }[];
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="link"
          size="sm"
          className="h-auto justify-start p-0 text-left whitespace-normal text-amber-700 dark:text-amber-400"
        >
          <Icon aria-hidden />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="max-h-64 w-80 overflow-y-auto text-sm">
        <p className="mb-2 text-muted-foreground">{note}</p>
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.key}>{item.text}</li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function Departures({ link }: { link: Link }) {
  return (
    <>
      {link.leftStudents.length > 0 && (
        <ListPopover
          icon={UserMinus}
          label={`${link.leftStudents.length} sinh viên đã rời khóa trên Moodle`}
          note="EWARS không tự xóa dữ liệu. Nếu sinh viên đã rút học phần, hãy đánh dấu Rút học phần ở hồ sơ sinh viên để không bị cảnh báo oan."
          items={link.leftStudents.map((s) => ({
            key: s.studentId,
            text: `${s.studentId} · phát hiện ${formatVnDateTime(s.detectedAt)}`,
          }))}
        />
      )}
      {link.removedActivities.length > 0 && (
        <ListPopover
          icon={FileX}
          label={`${link.removedActivities.length} bài đã xóa trên Moodle`}
          note="Bài vẫn còn trong EWARS (giới hạn đã biết) — kiểm tra lại nếu sinh viên bị cảnh báo vì bài này."
          items={link.removedActivities.map((a) => ({
            key: `${a.kind}-${a.name}-${a.detectedAt}`,
            text: `${a.kind === 'QUIZ' ? 'Trắc nghiệm' : 'Thực hành'}: ${a.name}`,
          }))}
        />
      )}
    </>
  );
}

function SyncState({ link }: { link: Link | null }) {
  if (!link?.lastSyncAt) return <span className="text-muted-foreground">Chưa đồng bộ</span>;
  return (
    <div className="flex flex-col gap-1">
      <span>{formatVnDateTime(link.lastSyncAt)}</span>
      {link.syncMode === 'AUTO' && link.lastCheckedAt && (
        <span className="text-muted-foreground">
          Dò thay đổi lúc {formatVnDateTime(link.lastCheckedAt)}
        </span>
      )}
      {link.lastError && (
        <span className="flex items-start gap-1 text-destructive">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {link.lastError}
        </span>
      )}
      {link.unknownStudents.length > 0 && (
        <ListPopover
          icon={UserX}
          label={`${link.unknownStudents.length} sinh viên Moodle chưa có trong EWARS`}
          note="Bỏ qua khi đồng bộ (không tính là lỗi). Nạp danh sách sinh viên của họ rồi đồng bộ lại."
          items={link.unknownStudents.map((u, i) => ({
            key: `${u.idnumber ?? ''}-${u.email ?? ''}-${i}`,
            text: `${u.idnumber || '(trống ID number)'} · ${u.email ?? '—'}`,
          }))}
        />
      )}
      <Departures link={link} />
    </div>
  );
}

function ModeButton({ link, name }: { link: Link; name: string }) {
  const auto = link.syncMode === 'AUTO';
  return (
    <ConfirmActionButton
      trigger={auto ? 'Về Chạy tay' : 'Bật Tự động'}
      triggerVariant="outline"
      title={auto ? `Chuyển ${name} về Chạy tay?` : `Bật Tự động cho ${name}?`}
      description={
        auto
          ? 'Dữ liệu Moodle chỉ được nạp khi bạn bấm Đồng bộ ngay rồi Xác nhận.'
          : 'Có thay đổi trên Moodle (điểm danh, bài nộp, bài mới) là EWARS tự kéo về, tự nạp (lô lỗi > 10% sẽ chờ bạn xem) và tự chạy đánh giá; đến hạn nộp cũng tự đánh giá lại. Cần đã xác nhận nạp ít nhất 1 lần.'
      }
      confirmLabel={auto ? 'Về Chạy tay' : 'Bật Tự động'}
      successMessage={auto ? 'Đã chuyển về Chạy tay' : 'Đã bật Tự động — đang kéo dữ liệu lần đầu'}
      onConfirm={() =>
        setMoodleSyncModeAction({ linkId: link.id, syncMode: auto ? 'MANUAL' : 'AUTO' })
      }
    />
  );
}

function RowActions({
  termId,
  row,
  canEdit,
}: {
  termId: string;
  row: MoodleCourseRowDto;
  canEdit: boolean;
}) {
  if (!canEdit) return null;
  const enabled = row.link?.enabled ?? false;
  if (!row.linkable && !enabled) return null;
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <ConfirmActionButton
        trigger={enabled ? 'Tắt đồng bộ' : 'Bật đồng bộ'}
        triggerVariant={enabled ? 'ghost' : 'default'}
        title={enabled ? `Tắt đồng bộ ${row.fullname}?` : `Bật đồng bộ ${row.fullname}?`}
        description={
          enabled
            ? 'Lần đồng bộ sau không đọc khóa học này nữa. Dữ liệu đã nạp vẫn giữ nguyên.'
            : `Từ lần "Đồng bộ ngay" tới, điểm danh, trắc nghiệm, bài thực hành của khóa học này được đưa vào học kỳ đang chọn (mã lớp học phần ${row.idnumber}).`
        }
        confirmLabel={enabled ? 'Tắt' : 'Bật'}
        successMessage={enabled ? 'Đã tắt đồng bộ khóa học' : 'Đã bật đồng bộ khóa học'}
        onConfirm={() =>
          setMoodleLinkAction({ termId, moodleCourseId: row.moodleCourseId, enabled: !enabled })
        }
      />
      {row.link && enabled && <ModeButton link={row.link} name={row.fullname} />}
      {row.link && <EditLinkDialog termId={termId} row={row} link={row.link} />}
    </div>
  );
}

function buildColumns(termId: string, canEdit: boolean): ColumnDef<MoodleCourseRowDto>[] {
  return [
    {
      accessorKey: 'fullname',
      header: 'Khóa học Moodle',
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.fullname}</span>
          <span className="text-muted-foreground">{row.original.shortname}</span>
        </div>
      ),
    },
    {
      accessorKey: 'idnumber',
      header: 'Course ID number',
      cell: ({ row }) =>
        row.original.linkable ? (
          <span className="font-mono">{row.original.idnumber}</span>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            {row.original.idnumber ? `${row.original.idnumber} — không phải 12 chữ số` : 'Chưa có'}
          </Badge>
        ),
    },
    {
      id: 'course',
      header: 'Học phần EWARS',
      enableSorting: false,
      cell: ({ row }) => {
        const link = row.original.link;
        if (!link) return <span className="text-muted-foreground">—</span>;
        return (
          <div className="flex flex-col">
            <span>{link.courseName}</span>
            <span className="text-muted-foreground">
              {link.courseId}
              {link.totalPeriodsOverride ? ` · ${link.totalPeriodsOverride} tiết (ghi đè)` : ''}
            </span>
          </div>
        );
      },
    },
    {
      id: 'enabled',
      header: 'Đồng bộ',
      enableSorting: false,
      cell: ({ row }) =>
        row.original.link?.enabled ? (
          <div className="flex flex-col items-start gap-1">
            <Badge variant="unstyled" className="border-transparent bg-primary-soft text-primary">
              Đang bật
            </Badge>
            <span className="text-muted-foreground">
              {row.original.link.syncMode === 'AUTO' ? 'Tự động' : 'Chạy tay'}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground">Tắt</span>
        ),
    },
    {
      id: 'lastSync',
      header: 'Lần đồng bộ gần nhất',
      enableSorting: false,
      cell: ({ row }) => <SyncState link={row.original.link} />,
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => <RowActions termId={termId} row={row.original} canEdit={canEdit} />,
    },
  ];
}

export function CourseLinkTable({
  termId,
  rows,
  canEdit,
}: {
  termId: string;
  rows: MoodleCourseRowDto[];
  canEdit: boolean;
}) {
  return (
    <DataTable
      columns={buildColumns(termId, canEdit)}
      data={rows}
      getRowId={(r) => String(r.moodleCourseId)}
      emptyMessage={
        <EmptyState
          icon={BookOpen}
          title="Moodle chưa có khóa học nào"
          description="Tạo khóa học trên Moodle, ghi mã lớp học phần (12 chữ số) vào ô Course ID number, rồi tải lại trang."
        />
      }
    />
  );
}
