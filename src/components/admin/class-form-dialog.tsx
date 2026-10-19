'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createClassAction, updateClassAction } from '@/modules/admin/actions/class.actions';
import type {
  AdvisorOptionDto,
  ClassDto,
  DepartmentDto,
} from '@/modules/admin/services/class.service';
import { type CreateClassInput, createClassSchema } from '@/modules/admin/validators/class';

/** Giá trị Select cho "chưa gán" (Radix Select không nhận chuỗi rỗng). */
export const NO_ADVISOR = '__none__';

interface ClassFormDialogProps {
  trigger: ReactNode;
  departments: DepartmentDto[];
  advisors: AdvisorOptionDto[];
  /** Có giá trị = sửa lớp (không đổi mã lớp, không đổi CVHT ở form này). */
  editing?: ClassDto;
}

export function ClassFormDialog({ trigger, departments, advisors, editing }: ClassFormDialogProps) {
  const [open, setOpen] = useState(false);
  const form = useForm<CreateClassInput>({
    resolver: zodResolver(createClassSchema),
    defaultValues: {
      classId: editing?.classId ?? '',
      className: editing?.className ?? '',
      departmentId: editing?.departmentId ?? '',
      cohortYear: editing?.cohortYear ?? '',
      advisorId: editing?.advisorId ?? '',
    },
  });

  const onSubmit = async (values: CreateClassInput) => {
    const result = editing
      ? await updateClassAction({
          classId: values.classId,
          className: values.className,
          departmentId: values.departmentId,
          cohortYear: values.cohortYear,
        })
      : await createClassAction(values);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(editing ? `Đã cập nhật lớp ${values.classId}` : `Đã tạo lớp ${values.classId}`);
    if (!editing) form.reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? `Sửa lớp ${editing.classId}` : 'Tạo lớp sinh hoạt'}</DialogTitle>
          <DialogDescription>Cố vấn học tập quản lý sinh viên qua lớp sinh hoạt.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={(e) => void form.handleSubmit(onSubmit)(e)} className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="classId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mã lớp</FormLabel>
                    <FormControl>
                      <Input placeholder="KTPM2311" disabled={Boolean(editing)} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cohortYear"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Khóa tuyển sinh</FormLabel>
                    <FormControl>
                      <Input placeholder="2023" inputMode="numeric" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="className"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tên lớp</FormLabel>
                  <FormControl>
                    <Input placeholder="Kỹ thuật phần mềm K2023" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="departmentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Khoa</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Chọn khoa" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {departments.map((d) => (
                        <SelectItem key={d.departmentId} value={d.departmentId}>
                          {d.departmentName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {!editing && (
              <FormField
                control={form.control}
                name="advisorId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cố vấn học tập</FormLabel>
                    <Select
                      value={field.value ? field.value : NO_ADVISOR}
                      onValueChange={(v) => field.onChange(v === NO_ADVISOR ? '' : v)}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_ADVISOR}>Chưa gán</SelectItem>
                        {advisors.map((a) => (
                          <SelectItem key={a.userId} value={a.userId}>
                            {a.fullName} ({a.userId})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
                {editing ? 'Lưu thay đổi' : 'Tạo lớp'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
