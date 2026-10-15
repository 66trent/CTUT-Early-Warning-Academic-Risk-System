'use client';

import { Loader2, Play } from 'lucide-react';
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
import { requestEvaluationAction } from '@/modules/rule-engine/actions/evaluation.actions';
import type { EvaluationFormOptionsDto } from '@/modules/rule-engine/services/evaluation-query.service';

/** Giá trị Select cho "tất cả" (Radix Select không nhận chuỗi rỗng). */
const ALL_COURSES = '__all__';

/**
 * "Chạy đánh giá ngay": chọn học kỳ, tùy chọn 1 học phần; ở chế độ demo được chọn mốc dữ liệu
 * trong quá khứ.
 */
export function RunForm({ options, busy }: { options: EvaluationFormOptionsDto; busy: boolean }) {
  const router = useRouter();
  const current = options.terms.find((t) => t.isCurrent) ?? options.terms[0];
  const [termId, setTermId] = useState(current?.termId ?? '');
  const [departmentId, setDepartmentId] = useState(ALL_COURSES);
  const [courseId, setCourseId] = useState(ALL_COURSES);
  const [asOfDate, setAsOfDate] = useState('');
  const [pending, setPending] = useState(false);
  // Khoa chỉ để lọc danh sách học phần — lần chạy vẫn theo học kỳ / học phần (docs/rules/08).
  const courses = options.courses.filter(
    (c) =>
      c.termId === termId &&
      (departmentId === ALL_COURSES || c.departmentIds.includes(departmentId)),
  );

  const submit = async () => {
    setPending(true);
    const result = await requestEvaluationAction({
      termId,
      courseId: courseId === ALL_COURSES ? '' : courseId,
      asOfDate,
    });
    setPending(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success('Đã đưa vào hàng đợi, hệ thống đang chạy đánh giá.');
    router.push(`/admin/evaluations/${result.data.runId}`);
  };

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="grid gap-2">
          <Label htmlFor="run-term">Học kỳ</Label>
          <Select
            value={termId}
            onValueChange={(value) => {
              setTermId(value);
              setCourseId(ALL_COURSES);
            }}
          >
            <SelectTrigger id="run-term" className="w-full">
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
        <div className="grid gap-2">
          <Label htmlFor="run-department">Lọc học phần theo khoa</Label>
          <Select
            value={departmentId}
            onValueChange={(value) => {
              setDepartmentId(value);
              setCourseId(ALL_COURSES);
            }}
          >
            <SelectTrigger id="run-department" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_COURSES}>Tất cả khoa</SelectItem>
              {options.departments.map((d) => (
                <SelectItem key={d.departmentId} value={d.departmentId}>
                  {d.departmentName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="run-course">Học phần</Label>
          <Select value={courseId} onValueChange={setCourseId}>
            <SelectTrigger id="run-course" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_COURSES}>Tất cả học phần</SelectItem>
              {courses.map((c) => (
                <SelectItem key={c.courseId} value={c.courseId}>
                  {c.courseId} · {c.courseName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {options.canChooseAsOf && (
          <div className="grid gap-2">
            <Label htmlFor="run-as-of">Mốc dữ liệu (chế độ demo, để trống = bây giờ)</Label>
            <Input
              id="run-as-of"
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
            />
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || busy || !termId}>
          {pending ? <Loader2 className="animate-spin" /> : <Play aria-hidden />}
          Chạy đánh giá ngay
        </Button>
        {busy && (
          <span className="text-sm text-muted-foreground">
            Đang có lần chạy chưa xong — chờ xong rồi chạy lại.
          </span>
        )}
      </div>
    </form>
  );
}
