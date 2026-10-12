'use client';

import { FileUp, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { uploadImportAction } from '@/modules/data-import/actions/import.actions';
import type { ImportFormOptionsDto } from '@/modules/data-import/services/import-query.service';

interface UploadFormProps {
  options: ImportFormOptionsDto;
  /** Nạp lại file đã sửa của 1 lô trước (liên kết `parentBatchId`). */
  parent: { batchId: string; dataType: string; termId: string | null } | null;
}

export function UploadForm({ options, parent }: UploadFormProps) {
  const router = useRouter();
  const currentTerm = options.terms.find((t) => t.isCurrent) ?? options.terms[0];
  const [dataType, setDataType] = useState(parent?.dataType ?? options.types[0]?.dataType ?? '');
  const [termId, setTermId] = useState(parent?.termId ?? currentTerm?.termId ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const selectedType = options.types.find((t) => t.dataType === dataType);
  const needsTerm = selectedType?.requiresTerm ?? false;

  const submit = async () => {
    if (!file) {
      toast.error('Chọn file cần nạp.');
      return;
    }
    setPending(true);
    const formData = new FormData();
    formData.set('dataType', dataType);
    formData.set('termId', needsTerm ? termId : '');
    formData.set('parentBatchId', parent?.batchId ?? '');
    formData.set('file', file);
    const result = await uploadImportAction(formData);
    setPending(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success('Đã tải file lên, hệ thống đang kiểm tra.');
    router.push(`/admin/imports/${result.data.batchId}`);
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
      </div>
      <div className="grid gap-2">
        <Label htmlFor="import-file">File dữ liệu (.csv hoặc .xlsx, tối đa 20MB)</Label>
        <Input
          id="import-file"
          type="file"
          accept=".csv,.xlsx"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>
      <div>
        <Button type="submit" disabled={pending || !file || (needsTerm && !termId)}>
          {pending ? <Loader2 className="animate-spin" /> : <FileUp aria-hidden />}
          {parent ? 'Nạp lại file đã sửa' : 'Tải lên và kiểm tra'}
        </Button>
      </div>
    </form>
  );
}
