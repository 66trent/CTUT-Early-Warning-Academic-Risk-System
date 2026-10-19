'use client';

import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from '@/lib/notify';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { changeClassAdvisorAction } from '@/modules/admin/actions/class.actions';
import type { AdvisorOptionDto, ClassDto } from '@/modules/admin/services/class.service';
import { NO_ADVISOR } from './class-form-dialog';

export function ChangeAdvisorDialog({
  classItem,
  advisors,
}: {
  classItem: ClassDto;
  advisors: AdvisorOptionDto[];
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(classItem.advisorId ?? NO_ADVISOR);
  const [pending, setPending] = useState(false);
  const unchanged = value === (classItem.advisorId ?? NO_ADVISOR);

  const save = async () => {
    setPending(true);
    const result = await changeClassAdvisorAction({
      classId: classItem.classId,
      advisorId: value === NO_ADVISOR ? '' : value,
    });
    setPending(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(`Đã cập nhật Cố vấn học tập lớp ${classItem.classId}`);
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setValue(classItem.advisorId ?? NO_ADVISOR);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          {classItem.advisorId ? 'Đổi Cố vấn' : 'Gán Cố vấn'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cố vấn học tập lớp {classItem.classId}</DialogTitle>
          <DialogDescription>
            Cố vấn học tập mới thấy và xử lý cảnh báo của sinh viên lớp này ngay sau khi lưu; người
            cũ không còn quyền xem.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="advisor-select">Cố vấn học tập</Label>
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger id="advisor-select" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_ADVISOR}>Chưa gán</SelectItem>
              {advisors.map((a) => (
                <SelectItem key={a.userId} value={a.userId}>
                  {a.fullName} ({a.userId})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button disabled={pending || unchanged} onClick={() => void save()}>
            {pending && <Loader2 className="animate-spin" />}
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
