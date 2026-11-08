'use client';

import { ChevronDown, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/** Gom file mẫu của mọi loại dữ liệu vào 1 nút, Excel trước vì ít lỗi bảng mã hơn CSV. */
export function TemplateMenu({ types }: { types: { label: string; templatePath: string }[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="self-start">
          <Download aria-hidden />
          Tải file mẫu
          <ChevronDown aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Excel (khuyên dùng)</DropdownMenuLabel>
        {types.map((t) => (
          <DropdownMenuItem key={t.label} asChild>
            <a href={t.templatePath.replace(/\.csv$/, '.xlsx')} download>
              {t.label}
            </a>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>CSV</DropdownMenuLabel>
        {types.map((t) => (
          <DropdownMenuItem key={t.label} asChild>
            <a href={t.templatePath} download>
              {t.label}
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
