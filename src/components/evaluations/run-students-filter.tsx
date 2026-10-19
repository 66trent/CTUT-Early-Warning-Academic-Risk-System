'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SEVERITY_ORDER } from '@/db/enums';
import { SEVERITY_LABELS } from '@/lib/labels';

const ALL = 'ALL';

/** Lọc kết quả lần chạy: chỉ sinh viên có dấu hiệu (mặc định), mức, lớp, luật — lưu trên URL. */
export function RunStudentsFilter({
  classes,
  rules,
}: {
  classes: string[];
  rules: { ruleCode: string; ruleName: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const showAll = params.get('all') === '1';

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '' || value === ALL) next.delete(key);
      else next.set(key, value);
    }
    next.delete('page');
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex gap-1">
        <Button
          size="sm"
          variant={showAll ? 'outline' : 'default'}
          aria-pressed={!showAll}
          onClick={() => update({ all: null })}
        >
          Có dấu hiệu
        </Button>
        <Button
          size="sm"
          variant={showAll ? 'default' : 'outline'}
          aria-pressed={showAll}
          onClick={() => update({ all: '1' })}
        >
          Tất cả sinh viên
        </Button>
      </div>
      <Select value={params.get('severity') ?? ALL} onValueChange={(v) => update({ severity: v })}>
        <SelectTrigger size="sm" className="w-full sm:w-44" aria-label="Lọc theo mức cao nhất">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Mọi mức</SelectItem>
          {[...SEVERITY_ORDER].reverse().map((s) => (
            <SelectItem key={s} value={s}>
              {SEVERITY_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {classes.length > 1 && (
        <Select value={params.get('classId') ?? ALL} onValueChange={(v) => update({ classId: v })}>
          <SelectTrigger size="sm" className="w-full sm:w-40" aria-label="Lọc theo lớp">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Mọi lớp</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {rules.length > 0 && (
        <Select
          value={params.get('ruleCode') ?? ALL}
          onValueChange={(v) => update({ ruleCode: v })}
        >
          <SelectTrigger size="sm" className="w-full sm:w-64" aria-label="Lọc theo luật">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Mọi luật</SelectItem>
            {rules.map((r) => (
              <SelectItem key={r.ruleCode} value={r.ruleCode}>
                {r.ruleCode} · {r.ruleName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
