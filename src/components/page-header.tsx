import { CircleHelp } from 'lucide-react';
import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface Crumb {
  label: string;
  /** Không có = trang hiện tại. */
  href?: string;
}

/** Đường dẫn vị trí trang (trang chi tiết) — mục cuối là trang hiện tại. */
export function PageBreadcrumbs({ items }: { items: Crumb[] }) {
  if (items.length === 0) return null;
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {items.map((c, i) => (
          <Fragment key={`${c.label}-${i}`}>
            {i > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              {c.href ? (
                <BreadcrumbLink asChild>
                  <Link href={c.href}>{c.label}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage className="max-w-64 truncate">{c.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

/**
 * Tiêu đề trang + mô tả + 1 hành động chính (docs/rules/07). `breadcrumbs` cho trang chi tiết;
 * `helpHref` mở đúng mục hướng dẫn (trang Bắt đầu).
 */
export function PageHeader({
  title,
  description,
  action,
  breadcrumbs,
  helpHref,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  breadcrumbs?: Crumb[];
  helpHref?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {breadcrumbs && <PageBreadcrumbs items={breadcrumbs} />}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <h1>{title}</h1>
            {helpHref && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    asChild
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground"
                  >
                    <Link href={helpHref} aria-label={`Hướng dẫn: ${title}`}>
                      <CircleHelp aria-hidden />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Xem hướng dẫn</TooltipContent>
              </Tooltip>
            )}
          </div>
          {description && <p className="mt-1 text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}
