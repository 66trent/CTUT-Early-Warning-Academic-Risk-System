'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { CircleCheck, CircleDashed, Clock, Loader2, Lock, MoreHorizontal } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from '@/lib/notify';
import { ConfirmActionButton } from '@/components/confirm-action-button';
import { DataTable } from '@/components/data-table/data-table';
import { Badge } from '@/components/ui/badge';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserAccountStatus, UserRole } from '@/db/enums';
import { ACCOUNT_STATUS_LABELS, ROLE_LABELS } from '@/lib/labels';
import type { SortDir } from '@/lib/list-params';
import {
  changeAccountStatusAction,
  changeRoleAction,
  changeStaffCodeAction,
} from '@/modules/admin/actions/account.actions';
import type { AccountDto } from '@/modules/admin/services/account.service';

const STATUS_ICON = {
  [UserAccountStatus.PENDING_APPROVAL]: Clock,
  [UserAccountStatus.ACTIVE]: CircleCheck,
  [UserAccountStatus.REJECTED]: CircleDashed,
  [UserAccountStatus.SUSPENDED]: Lock,
} as const;

function AccountStatusBadge({ status }: { status: UserAccountStatus }) {
  const Icon = STATUS_ICON[status];
  return (
    <Badge
      variant="outline"
      className={status === UserAccountStatus.ACTIVE ? 'gap-1' : 'gap-1 text-muted-foreground'}
    >
      <Icon aria-hidden />
      {ACCOUNT_STATUS_LABELS[status]}
    </Badge>
  );
}

function StaffCodeDialog({ account }: { account: AccountDto }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(account.userId);
  const [pending, setPending] = useState(false);

  const save = async () => {
    setPending(true);
    const result = await changeStaffCodeAction({ userId: account.userId, newUserId: value });
    setPending(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success('Đã sửa mã cán bộ');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          Sửa mã
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sửa mã cán bộ</DialogTitle>
          <DialogDescription>
            Chỉ sửa được khi tài khoản còn chờ duyệt. Mã cán bộ dùng để gán lớp và tra cứu.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="staff-code">Mã cán bộ</Label>
          <Input
            id="staff-code"
            value={value}
            onChange={(e) => setValue(e.target.value.toUpperCase())}
          />
        </div>
        <DialogFooter>
          <Button disabled={pending || value.trim() === ''} onClick={() => void save()}>
            {pending && <Loader2 className="animate-spin" />}
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AccountActions({
  account,
  currentUserId,
}: {
  account: AccountDto;
  currentUserId: string;
}) {
  if (account.role === UserRole.STUDENT) return null;
  if (account.userId === currentUserId) {
    return <span className="text-xs text-muted-foreground">Tài khoản của bạn</span>;
  }
  const name = `${account.fullName} (${account.userId})`;
  const status = (action: 'APPROVE' | 'REJECT' | 'SUSPEND' | 'REACTIVATE') => () =>
    changeAccountStatusAction({ userId: account.userId, action });

  if (account.accountStatus === UserAccountStatus.PENDING_APPROVAL) {
    return (
      <div className="flex flex-wrap justify-end gap-2">
        <ConfirmActionButton
          trigger="Duyệt"
          triggerVariant="default"
          title={`Duyệt tài khoản ${name}?`}
          description={
            account.emailVerified
              ? 'Cố vấn học tập sẽ đăng nhập và sử dụng được hệ thống.'
              : 'Email chưa được xác minh — sau khi duyệt, người dùng vẫn phải xác minh email mới đăng nhập được.'
          }
          confirmLabel="Duyệt"
          successMessage="Đã duyệt tài khoản"
          onConfirm={status('APPROVE')}
        />
        <ConfirmActionButton
          trigger="Từ chối"
          triggerVariant="ghost"
          destructive
          title={`Từ chối đăng ký của ${name}?`}
          description="Người dùng sẽ không đăng nhập được vào hệ thống."
          confirmLabel="Từ chối"
          successMessage="Đã từ chối đăng ký"
          onConfirm={status('REJECT')}
        />
        <StaffCodeDialog account={account} />
      </div>
    );
  }

  if (account.accountStatus === UserAccountStatus.ACTIVE) {
    const nextRole = account.role === UserRole.ADVISOR ? UserRole.ADMIN : UserRole.ADVISOR;
    return (
      <div className="flex flex-wrap justify-end gap-2">
        <ConfirmActionButton
          trigger={`Đổi thành ${ROLE_LABELS[nextRole]}`}
          title={`Đổi vai trò của ${name}?`}
          description={`Vai trò mới: ${ROLE_LABELS[nextRole]}. Quyền truy cập thay đổi ngay ở lần tải trang kế tiếp.`}
          confirmLabel="Đổi vai trò"
          successMessage="Đã đổi vai trò"
          onConfirm={() => changeRoleAction({ userId: account.userId, role: nextRole })}
        />
        <ConfirmActionButton
          trigger="Khóa"
          triggerVariant="ghost"
          destructive
          title={`Khóa tài khoản ${name}?`}
          description="Người dùng sẽ không truy cập được dữ liệu cho đến khi được mở khóa."
          confirmLabel="Khóa"
          successMessage="Đã khóa tài khoản"
          onConfirm={status('SUSPEND')}
        />
      </div>
    );
  }

  if (account.accountStatus === UserAccountStatus.SUSPENDED) {
    return (
      <div className="flex justify-end">
        <ConfirmActionButton
          trigger="Mở khóa"
          title={`Mở khóa tài khoản ${name}?`}
          description="Người dùng sẽ truy cập lại được hệ thống."
          confirmLabel="Mở khóa"
          successMessage="Đã mở khóa tài khoản"
          onConfirm={status('REACTIVATE')}
        />
      </div>
    );
  }
  return <MoreHorizontal aria-hidden className="ml-auto size-4 text-muted-foreground" />;
}

/** Cố vấn học tập: các lớp phụ trách (bấm sang trang lớp); sinh viên: lớp sinh hoạt. */
function AccountClasses({ account }: { account: AccountDto }) {
  if (account.role === UserRole.STUDENT) {
    return <span className="tabular-nums">{account.classId ?? '—'}</span>;
  }
  if (
    account.role !== UserRole.ADVISOR ||
    account.accountStatus === UserAccountStatus.PENDING_APPROVAL
  ) {
    return <span className="text-muted-foreground">—</span>;
  }
  if (account.advisedClasses.length === 0) {
    return (
      <Badge variant="outline" className="text-amber-700 dark:text-amber-400">
        Chưa gán lớp
      </Badge>
    );
  }
  return (
    <span className="flex flex-wrap gap-1">
      {account.advisedClasses.map((c) => (
        <Link
          key={c.classId}
          href={`/admin/classes?q=${encodeURIComponent(c.classId)}`}
          className="rounded-md border px-1.5 py-0.5 text-xs tabular-nums hover:bg-secondary"
          title={`Lớp ${c.classId} · ${c.studentCount} sinh viên`}
        >
          {c.classId} · {c.studentCount} SV
        </Link>
      ))}
    </span>
  );
}

export function AccountsTable({
  accounts,
  currentUserId,
  sort,
}: {
  accounts: AccountDto[];
  currentUserId: string;
  sort: { sort: string | null; dir: SortDir };
}) {
  const columns: ColumnDef<AccountDto>[] = [
    { accessorKey: 'userId', header: 'Mã', meta: { sortKey: 'userId' } },
    {
      accessorKey: 'fullName',
      header: 'Họ tên',
      meta: { sortKey: 'fullName', mobile: 'title' },
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }) => (
        <span className="inline-flex flex-col">
          {row.original.email}
          {row.original.emailVerified === false && (
            <span className="text-xs text-muted-foreground">Chưa xác minh email</span>
          )}
        </span>
      ),
    },
    {
      accessorKey: 'role',
      header: 'Vai trò',
      meta: { sortKey: 'role' },
      cell: ({ row }) => ROLE_LABELS[row.original.role],
    },
    {
      id: 'classes',
      header: 'Lớp',
      meta: { label: 'Lớp' },
      cell: ({ row }) => <AccountClasses account={row.original} />,
    },
    {
      accessorKey: 'accountStatus',
      header: 'Trạng thái',
      meta: { sortKey: 'accountStatus' },
      cell: ({ row }) => <AccountStatusBadge status={row.original.accountStatus} />,
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => <AccountActions account={row.original} currentUserId={currentUserId} />,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={accounts}
      getRowId={(a) => a.userId}
      serverSort={sort}
      emptyMessage="Không có tài khoản nào khớp bộ lọc."
    />
  );
}
