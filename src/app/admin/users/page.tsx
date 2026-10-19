import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AccountsFilter } from '@/components/admin/accounts-filter';
import { AccountsTable } from '@/components/admin/accounts-table';
import { DataPagination } from '@/components/data-table/data-pagination';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { UserRole } from '@/db/enums';
import { requireUser } from '@/lib/auth-server';
import { HELP_LINKS } from '@/lib/help-links';
import { parseListParams, type RawSearchParams } from '@/lib/list-params';
import { ACCOUNT_SORT_KEYS, listAccounts } from '@/modules/admin/services/account.service';
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
  const result = await listAccounts(filter, list);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        helpHref={HELP_LINKS.users}
        title="Tài khoản"
        description="Duyệt đăng ký Cố vấn học tập, khóa hoặc đổi vai trò tài khoản cán bộ. Tài khoản chờ duyệt hiện đầu danh sách."
      />
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
