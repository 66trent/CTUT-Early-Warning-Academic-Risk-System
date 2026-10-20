'use client';

import { FileUp, Loader2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { toast } from '@/lib/notify';
import { formatFileSize } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  discardImportAction,
  uploadImportAction,
} from '@/modules/data-import/actions/import.actions';
import { IMPORT_LIMITS } from '@/modules/data-import/parsing/errors';
import type { ImportFormOptionsDto } from '@/modules/data-import/services/import-query.service';

interface UploadFormProps {
  options: ImportFormOptionsDto;
  /** Nạp lại file đã sửa của 1 lô trước (liên kết `parentBatchId`). */
  parent: { batchId: string; dataType: string; termId: string | null } | null;
}

/** Giá trị Select cho "tự nhận diện từ file" (Radix Select không nhận chuỗi rỗng). */
const AUTO_COURSE = '__auto__';
const ACCEPTED = /\.(csv|xlsx)$/i;

/** Thêm file vào danh sách đã chọn: bỏ file sai đuôi / quá 20MB / trùng tên, tối đa 50 file. */
function mergeFiles(current: File[], added: File[]): { files: File[]; problems: string[] } {
  const files = [...current];
  const problems: string[] = [];
  for (const file of added) {
    if (!ACCEPTED.test(file.name)) problems.push(`${file.name}: chỉ nhận .csv hoặc .xlsx`);
    else if (file.size > IMPORT_LIMITS.maxUploadBytes) problems.push(`${file.name}: quá 20MB`);
    else if (files.some((f) => f.name === file.name)) continue;
    else if (files.length >= IMPORT_LIMITS.maxFilesPerBatch) {
      problems.push(`Mỗi lần nạp tối đa ${IMPORT_LIMITS.maxFilesPerBatch} file`);
      break;
    } else files.push(file);
  }
  return { files, problems };
}

export function UploadForm({ options, parent }: UploadFormProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const currentTerm = options.terms.find((t) => t.isCurrent) ?? options.terms[0];
  const [dataType, setDataType] = useState(parent?.dataType ?? options.types[0]?.dataType ?? '');
  const [termId, setTermId] = useState(parent?.termId ?? currentTerm?.termId ?? '');
  const [courseId, setCourseId] = useState(AUTO_COURSE);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  /** Số file đã gửi xong (null = chưa gửi). */
  const [sent, setSent] = useState<number | null>(null);
  const pending = sent !== null;
  const selectedType = options.types.find((t) => t.dataType === dataType);
  const needsTerm = selectedType?.requiresTerm ?? false;
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  const addFiles = (added: File[]) => {
    const merged = mergeFiles(files, added);
    setFiles(merged.files);
    if (merged.problems.length) toast.error(merged.problems.join(' · '));
  };

  /** Gửi lần lượt từng file (Server Action ≤ 21MB/lần), file cuối bắt đầu kiểm tra cả lô. */
  const submit = async () => {
    if (files.length === 0) {
      toast.error('Chọn file cần nạp.');
      return;
    }
    setSent(0);
    let batchId = '';
    for (const [i, file] of files.entries()) {
      const formData = new FormData();
      formData.set('dataType', dataType);
      formData.set('termId', needsTerm ? termId : '');
      formData.set('courseId', needsTerm && courseId !== AUTO_COURSE ? courseId : '');
      formData.set('parentBatchId', parent?.batchId ?? '');
      formData.set('batchId', batchId);
      formData.set('last', i === files.length - 1 ? '1' : '');
      formData.set('file', file);
      const result = await uploadImportAction(formData);
      if (!result.ok) {
        if (batchId) await discardImportAction({ batchId });
        setSent(null);
        toast.error(result.message);
        return;
      }
      batchId = result.data.batchId;
      setSent(i + 1);
    }
    toast.success(
      files.length > 1
        ? `Đã tải ${files.length} file lên, hệ thống đang kiểm tra.`
        : 'Đã tải file lên, hệ thống đang kiểm tra.',
    );
    router.push(`/admin/imports/${batchId}`);
  };

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="import-type">Loại dữ liệu</Label>
          <Select value={dataType} onValueChange={setDataType} disabled={Boolean(parent)}>
            <SelectTrigger id="import-type" className="w-full">
              <SelectValue placeholder="Chọn loại dữ liệu" />
            </SelectTrigger>
            <SelectContent>
              {options.types.map((t) => (
                <SelectItem key={t.dataType} value={t.dataType}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {needsTerm && (
          <div className="grid gap-2">
            <Label htmlFor="import-term">Học kỳ</Label>
            <Select value={termId} onValueChange={setTermId} disabled={Boolean(parent)}>
              <SelectTrigger id="import-term" className="w-full">
                <SelectValue placeholder="Chọn học kỳ" />
              </SelectTrigger>
              <SelectContent>
                {options.terms.map((t) => (
                  <SelectItem key={t.termId} value={t.termId}>
                    {t.termName}
                    {t.isCurrent ? ' (hiện tại)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {needsTerm && (
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="import-course">Học phần (tùy chọn)</Label>
            <Select value={courseId} onValueChange={setCourseId} disabled={Boolean(parent)}>
              <SelectTrigger id="import-course" className="w-full">
                <SelectValue placeholder="Tự nhận diện từ file" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AUTO_COURSE}>
                  Tự nhận diện từ file (1 hoặc nhiều học phần)
                </SelectItem>
                {options.courses.map((c) => (
                  <SelectItem key={c.courseId} value={c.courseId}>
                    {c.courseName} · {c.courseId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Chọn khi mọi file chỉ của 1 học phần: dòng thuộc học phần khác sẽ bị báo lỗi. Không
              cần chọn khoa hay lớp — hệ thống tự đọc lớp sinh hoạt, khoa của từng sinh viên và hiện
              ở bước xem trước.
            </p>
          </div>
        )}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="import-file">
          File dữ liệu (.csv hoặc .xlsx — chọn được nhiều file cùng loại, tối đa{' '}
          {IMPORT_LIMITS.maxFilesPerBatch} file, mỗi file ≤ 20MB)
        </Label>
        <div
          className={`flex flex-col items-center gap-2 rounded-md border border-dashed p-4 text-center text-sm transition-colors ${
            dragging ? 'border-primary bg-primary/5' : 'bg-background'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (!pending) addFiles([...e.dataTransfer.files]);
          }}
        >
          <FileUp aria-hidden className="size-5 text-muted-foreground" />
          <p className="text-muted-foreground">
            Kéo thả file vào đây, hoặc{' '}
            <Button
              type="button"
              variant="link"
              className="h-auto p-0"
              disabled={pending}
              onClick={() => inputRef.current?.click()}
            >
              chọn file
            </Button>
          </p>
          <input
            ref={inputRef}
            id="import-file"
            type="file"
            multiple
            accept=".csv,.xlsx"
            className="sr-only"
            // Bàn phím dùng nút "chọn file" — tránh điểm dừng Tab vô hình.
            tabIndex={-1}
            onChange={(e) => {
              addFiles([...(e.target.files ?? [])]);
              e.target.value = '';
            }}
          />
        </div>
        {files.length > 0 && (
          <div className="rounded-md border">
            <p className="flex flex-wrap justify-between gap-2 border-b px-3 py-2 text-xs text-muted-foreground">
              <span>
                Đã chọn {files.length} file · {formatFileSize(totalSize)}
              </span>
              {!pending && (
                <button
                  type="button"
                  className="underline underline-offset-2 hover:text-foreground"
                  onClick={() => setFiles([])}
                >
                  Bỏ chọn tất cả
                </button>
              )}
            </p>
            <ul className="max-h-56 divide-y overflow-y-auto">
              {files.map((f) => (
                <li key={f.name} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                  <span className="min-w-0 flex-1 break-all">{f.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {formatFileSize(f.size)}
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-7 shrink-0"
                    disabled={pending}
                    aria-label={`Bỏ file ${f.name}`}
                    onClick={() => setFiles(files.filter((x) => x !== f))}
                  >
                    <X aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {pending && files.length > 1 && (
        <div className="grid gap-1" aria-live="polite">
          <Progress value={(sent / files.length) * 100} aria-label="Tiến độ tải lên" />
          <p className="text-xs text-muted-foreground">
            Đang tải lên {sent}/{files.length} file…
          </p>
        </div>
      )}
      <div>
        <Button type="submit" disabled={pending || files.length === 0 || (needsTerm && !termId)}>
          {pending ? <Loader2 className="animate-spin" /> : <FileUp aria-hidden />}
          {parent
            ? 'Nạp lại file đã sửa'
            : files.length > 1
              ? `Tải ${files.length} file lên và kiểm tra`
              : 'Tải lên và kiểm tra'}
        </Button>
      </div>
    </form>
  );
}
