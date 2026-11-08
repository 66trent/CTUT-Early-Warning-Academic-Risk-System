'use client';

import { useRouter } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PAGE_SIZES, type RawSearchParams, withParams } from '@/lib/list-params';

/** Chọn số dòng mỗi trang — đổi số dòng thì về trang 1. */
export function PageSizeSelect({
  value,
  basePath,
  params,
  pageParam,
  sizeParam,
}: {
  value: number;
  basePath: string;
  params: RawSearchParams;
  pageParam: string;
  sizeParam: string;
}) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2">
      <span>Số dòng</span>
      <Select
        value={String(value)}
        onValueChange={(size) =>
          router.push(`${basePath}${withParams(params, { [sizeParam]: size, [pageParam]: null })}`)
        }
      >
        <SelectTrigger size="sm" className="w-20" aria-label="Số dòng mỗi trang">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PAGE_SIZES.map((s) => (
            <SelectItem key={s} value={String(s)}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
