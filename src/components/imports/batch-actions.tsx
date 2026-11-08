'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ConfirmActionButton } from '@/components/confirm-action-button';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  confirmImportAction,
  discardImportAction,
  rollbackImportAction,
} from '@/modules/data-import/actions/import.actions';

/** Lô đang được worker xử lý → tự làm mới mỗi 2 giây để thấy tiến trình. */
export function AutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), 2000);
    return () => clearInterval(timer);
  }, [active, router]);
  return null;
}

export function StagedActions({
  batchId,
  successRows,
  errorRows,
}: {
  batchId: string;
  successRows: number;
  errorRows: number;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <ConfirmActionButton
        trigger={`Xác nhận nhập ${successRows} dòng`}
        triggerVariant="default"
        title={`Nhập ${successRows} dòng hợp lệ?`}
        description={
          errorRows > 0
            ? `${errorRows} dòng lỗi sẽ không được nhập, bạn tải file lỗi để sửa rồi nhập lại sau. Hệ thống kiểm tra lại toàn bộ trước khi ghi.`
            : 'Hệ thống kiểm tra lại toàn bộ trước khi ghi dữ liệu.'
        }
        confirmLabel="Nhập dữ liệu"
        successMessage="Đã xác nhận, hệ thống đang nhập dữ liệu."
        onConfirm={() => confirmImportAction({ batchId })}
      />
      <ConfirmActionButton
        trigger="Hủy đợt nhập"
        triggerVariant="ghost"
        destructive
        title="Hủy đợt nhập này?"
        description="Không có dữ liệu nào được ghi. Bạn có thể nhập lại cùng file sau khi hủy."
        confirmLabel="Hủy đợt nhập"
        successMessage="Đã hủy đợt nhập."
        onConfirm={() => discardImportAction({ batchId })}
      />
    </div>
  );
}

/** Lô tải lên dở (trình duyệt đóng giữa chừng) — hủy để nạp lại. */
export function UploadingActions({ batchId }: { batchId: string }) {
  return (
    <ConfirmActionButton
      trigger="Hủy lần nhập này"
      triggerVariant="outline"
      destructive
      title="Hủy lần nhập đang tải lên?"
      description="Các file đã tải lên sẽ bị bỏ, không có dữ liệu nào được ghi. Đợt nhập tải lên dở quá 1 ngày cũng tự hủy."
      confirmLabel="Hủy"
      successMessage="Đã hủy lần nhập."
      onConfirm={() => discardImportAction({ batchId })}
    />
  );
}

export function RollbackAction({
  batchId,
  allowed,
  reason,
}: {
  batchId: string;
  allowed: boolean;
  reason: string | null;
}) {
  if (!allowed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0}>
            <Button size="sm" variant="outline" disabled>
              Hoàn tác đợt nhập
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">{reason}</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <ConfirmActionButton
      trigger="Hoàn tác đợt nhập"
      destructive
      title="Hoàn tác đợt nhập này?"
      description="Xóa toàn bộ dữ liệu mà đợt nhập này đã thêm mới. Thao tác được ghi nhật ký và không thể làm lại."
      confirmLabel="Hoàn tác"
      successMessage="Đã hoàn tác đợt nhập."
      onConfirm={() => rollbackImportAction({ batchId })}
    />
  );
}
