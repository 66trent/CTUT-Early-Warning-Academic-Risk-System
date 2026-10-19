'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  requestTermClosingAction,
  termMissingResultsAction,
} from '@/modules/rule-engine/actions/evaluation.actions';
import type { MissingResultDto } from '@/modules/rule-engine/services/evaluation-run.service';

const SHOW_MAX = 10;

/**
 * "Chốt học kỳ" (docs/rules/08, chốt 2026-10-18): liệt kê sinh viên còn học phần chưa có kết quả
 * → xác nhận → lần chạy đánh giá cuối; chạy xong hệ thống mới đặt học kỳ "đã chốt".
 */
export function CloseTermDialog({
  termId,
  termName,
  canChooseAsOf,
}: {
  termId: string;
  termName: string;
  canChooseAsOf: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [missing, setMissing] = useState<MissingResultDto[] | null>(null);
  const [asOfDate, setAsOfDate] = useState('');
  const [pending, setPending] = useState(false);

  const onOpenChange = async (next: boolean) => {
    setOpen(next);
    if (!next) return;
    setMissing(null);
    const result = await termMissingResultsAction({ termId });
    if (result.ok) setMissing(result.data);
    else toast.error(result.message);
  };

  const confirm = async () => {
    setPending(true);
    const result = await requestTermClosingAction({ termId, asOfDate });
    setPending(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(`Đang chạy đánh giá cuối — ${termName} sẽ được chốt khi chạy xong.`);
    setOpen(false);
    router.push(`/admin/evaluations/${result.data.runId}`);
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => void onOpenChange(next)}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="ghost">
          Chốt học kỳ
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Chốt {termName}?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="grid gap-3">
              <p>
                Hệ thống chạy đánh giá lần cuối (tín chỉ không đạt, điểm trung bình học kỳ) rồi chốt
                học kỳ. Sau khi chốt, học kỳ không nhận thêm dữ liệu và không chạy đánh giá mới.{' '}
                <strong>Không thể mở lại.</strong>
              </p>
              {missing === null ? (
                <p className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Đang kiểm tra kết quả học phần…
                </p>
              ) : missing.length === 0 ? (
                <p className="text-foreground">Mọi sinh viên đã có đủ kết quả học phần.</p>
              ) : (
                <div className="grid gap-1 text-foreground">
                  <p className="font-medium text-amber-700 dark:text-amber-300">
                    {missing.length} sinh viên còn học phần chưa có kết quả — đánh giá cuối chỉ tính
                    trên học phần đã có:
                  </p>
                  <ul className="max-h-48 list-disc overflow-y-auto pl-5 text-sm">
                    {missing.slice(0, SHOW_MAX).map((m) => (
                      <li key={m.studentId}>
                        {m.fullName} · {m.studentId} ({m.classId}):{' '}
                        {m.courses.map((c) => c.courseName).join(', ')}
                      </li>
                    ))}
                  </ul>
                  {missing.length > SHOW_MAX && (
                    <p className="text-sm text-muted-foreground">
                      … và {missing.length - SHOW_MAX} sinh viên khác.
                    </p>
                  )}
                </div>
              )}
              {canChooseAsOf && (
                <div className="grid gap-2 text-foreground">
                  <Label htmlFor="close-as-of">Mốc dữ liệu (chế độ demo, để trống = bây giờ)</Label>
                  <Input
                    id="close-as-of"
                    type="date"
                    value={asOfDate}
                    onChange={(e) => setAsOfDate(e.target.value)}
                  />
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Hủy</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending || missing === null}
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={(e) => {
              e.preventDefault();
              void confirm();
            }}
          >
            {pending && <Loader2 className="animate-spin" />}
            Chạy đánh giá cuối và chốt
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
