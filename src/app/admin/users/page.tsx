import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { AccountsFilter } from '@/components/admin/accounts-filter';
import { AccountsTable } from '@/components/admin/accounts-table';
import { DataPagination } from '@/components/data-table/data-pagination';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { UserAccountStatus, UserRole } from '@/db/enums';
import { requireUser } from '@/lib/auth-server';
import { HELP_LINKS } from '@/lib/help-links';
import { parseListParams, type RawSearchParams, withParams } from '@/lib/list-params';
import { cn } from '@/lib/utils';
import {
  ACCOUNT_SORT_KEYS,
  countAccountsByStatus,
  listAccounts,
} from '@/modules/admin/services/account.service';
import { accountFilterSchema } from '@/modules/admin/validators/account';

export const metadata: Metadata = { title: 'Tài khoản' };

interface UsersPageProps {
  searchParams: Promise<RawSearchParams>;
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const user = await requireUser([UserRole.ADMIN]);
  const params = await searchParams;
  const filter = accountFilterSchema.parse(params);
  const list = parseListParams(params, ACCOUNT_SORT_KEYS);
  const [result, counts] = await Promise.all([
    listAccounts(filter, list),
    countAccountsByStatus(filter),
  ]);
  const cards = [
    { status: UserAccountStatus.PENDING_APPROVAL, label: 'Chờ duyệt' },
    { status: UserAccountStatus.ACTIVE, label: 'Đang hoạt động' },
    { status: UserAccountStatus.SUSPENDED, label: 'Bị khóa' },
  ] as const;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        helpHref={HELP_LINKS.users}
        title="Tài khoản"
        description="Duyệt đăng ký Cố vấn học tập, khóa hoặc đổi vai trò tài khoản cán bộ. Tài khoản chờ duyệt hiện đầu danh sách."
      />
      <div className="grid grid-cols-3 gap-3" aria-label="Lọc nhanh theo trạng thái">
        {cards.map((c) => {
          const active = filter.status === c.status;
          return (
            <Link
              key={c.status}
              href={`/admin/users${withParams(params, { status: active ? null : c.status, page: null })}`}
              aria-current={active ? 'true' : undefined}
              className={cn(
                'rounded-xl border bg-card p-3 shadow-sm transition-colors hover:bg-secondary',
                active && 'border-primary bg-primary-soft',
              )}
            >
              <p className="text-sm text-muted-foreground">{c.label}</p>
              <p
                className={cn(
                  'text-2xl font-semibold tabular-nums',
                  c.status === UserAccountStatus.PENDING_APPROVAL && counts[c.status] > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-accent-strong',
                )}
              >
                {counts[c.status]}
              </p>
            </Link>
          );
        })}
      </div>
      <Card className="shadow-sm">
        <CardContent className="flex flex-col gap-4">
          <Suspense>
            <AccountsFilter />
          </Suspense>
          <AccountsTable
            accounts={result.items}
            currentUserId={user.userId}
            sort={{ sort: list.sort, dir: list.dir }}
          />
          <DataPagination
            basePath="/admin/users"
            params={params}
            total={result.total}
            page={result.page}
            size={result.size}
            unit="tài khoản"
          />
        </CardContent>
      </Card>
    </div>
  );
}
