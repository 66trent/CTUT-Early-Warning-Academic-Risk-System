import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  /** 1 câu giải thích vì sao trống / cần làm gì (docs/rules/07). */
  description?: string;
  /** Việc nên làm tiếp. */
  action?: { href: string; label: string };
  className?: string;
}

/** Ô trống có hướng dẫn — thay cho câu "Không có dữ liệu" (docs/rules/07). */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-2 px-4 py-8 text-center', className)}>
      {Icon && (
        <span className="flex size-10 items-center justify-center rounded-full bg-muted">
          <Icon aria-hidden className="size-5 text-muted-foreground" />
        </span>
      )}
      <p className="font-medium text-foreground">{title}</p>
      {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && (
        <Button asChild size="sm" variant="outline" className="mt-2">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      )}
    </div>
  );
}
