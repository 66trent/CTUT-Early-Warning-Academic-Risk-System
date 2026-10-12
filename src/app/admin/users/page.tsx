import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { AccountsFilter } from '@/components/admin/accounts-filter';
import { AccountsTable } from '@/components/admin/accounts-table';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { UserRole } from '@/db/enums';
import { requireUser } from '@/lib/auth-server';
import { listAccounts } from '@/modules/admin/services/account.service';
import { accountFilterSchema } from '@/modules/admin/validators/account';

export const metadata: Metadata = { title: 'Tài khoản' };

interface UsersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function pageHref(params: Record<string, string | string[] | undefined>, page: number): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && key !== 'page') next.set(key, value);
  }
  next.set('page', String(page));
  return `/admin/users?${next.toString()}`;
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const user = await requireUser([UserRole.ADMIN]);
  const params = await searchParams;
  const filter = accountFilterSchema.parse(params);
  const result = await listAccounts(filter);
  const lastPage = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        title="Tài khoản"
        description="Duyệt đăng ký Cố vấn học tập, khóa hoặc đổi vai trò tài khoản cán bộ. Tài khoản chờ duyệt hiện đầu danh sách."
      />
      <Card className="shadow-sm">
        <CardContent className="flex flex-col gap-4">
          <Suspense>
            <AccountsFilter />
          </Suspense>
          <AccountsTable accounts={result.items} currentUserId={user.userId} />
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {result.total} tài khoản · trang {result.page}/{lastPage}
            </span>
            <div className="flex gap-2">
              {result.page > 1 && (
                <Button asChild size="sm" variant="outline">
                  <Link href={pageHref(params, result.page - 1)}>Trang trước</Link>
                </Button>
              )}
              {result.page < lastPage && (
                <Button asChild size="sm" variant="outline">
                  <Link href={pageHref(params, result.page + 1)}>Trang sau</Link>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
