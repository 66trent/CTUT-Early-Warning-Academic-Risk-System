'use client';

import { Loader2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { type ActionResult } from '@/lib/errors';

interface ConfirmActionButtonProps {
  trigger: ReactNode;
  triggerVariant?: 'default' | 'outline' | 'ghost' | 'destructive';
  title: string;
  description: ReactNode;
  confirmLabel: string;
  successMessage: string;
  destructive?: boolean;
  onConfirm: () => Promise<ActionResult<unknown>>;
}

/** Thao tác cần xác nhận lần 2 (docs/rules/07) — AlertDialog, phản hồi bằng Toast. */
export function ConfirmActionButton({
  trigger,
  triggerVariant = 'outline',
  title,
  description,
  confirmLabel,
  successMessage,
  destructive = false,
  onConfirm,
}: ConfirmActionButtonProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const confirm = async () => {
    setPending(true);
    const result = await onConfirm();
    setPending(false);
    if (result.ok) {
      toast.success(successMessage);
      setOpen(false);
    } else {
      toast.error(result.message);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant={triggerVariant}>
          {trigger}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Hủy</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            className={
              destructive ? 'bg-destructive text-white hover:bg-destructive/90' : undefined
            }
            onClick={(e) => {
              e.preventDefault();
              void confirm();
            }}
          >
            {pending && <Loader2 className="animate-spin" />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
