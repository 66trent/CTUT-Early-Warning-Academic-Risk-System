'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
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

const schema = z.object({
  classId: z
    .string()
    .trim()
    .regex(/^[A-Z]{2,6}\d{4}$/, 'Mã lớp gồm chữ in hoa và 4 chữ số, ví dụ KTPM2311'),
  className: z.string().trim().min(3, 'Tên lớp cần ít nhất 3 ký tự'),
  cohortYear: z.string().min(1, 'Chọn khóa tuyển sinh'),
});

type FormValues = z.infer<typeof schema>;

/** Form mẫu: react-hook-form + zodResolver + shadcn Form (docs/rules/03). */
export function SampleForm() {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { classId: '', className: '', cohortYear: '' },
  });

  const onSubmit = (values: FormValues) => {
    toast.success(`Đã kiểm tra hợp lệ lớp ${values.classId}`);
  };

  return (
    <Form {...form}>
      <form
        onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}
        className="grid gap-4 sm:max-w-md"
      >
        <FormField
          control={form.control}
          name="classId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mã lớp sinh hoạt</FormLabel>
              <FormControl>
                <Input placeholder="KTPM2311" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="className"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tên lớp</FormLabel>
              <FormControl>
                <Input placeholder="Kỹ thuật phần mềm K2023" {...field} />
              </FormControl>
              <FormDescription>Tên hiển thị cho Cố vấn học tập và sinh viên.</FormDescription>
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
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Chọn khóa" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="2023">2023</SelectItem>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex gap-2">
          <Button type="submit">Lưu</Button>
          <Button type="button" variant="outline" onClick={() => form.reset()}>
            Hủy
          </Button>
        </div>
      </form>
    </Form>
  );
}
