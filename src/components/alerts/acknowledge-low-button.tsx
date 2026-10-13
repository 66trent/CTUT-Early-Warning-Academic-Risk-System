'use client';

import { CheckCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { acknowledgeLowAlertsAction } from '@/modules/alerts/actions/alert.actions';

/** "Đánh dấu đã xem" mọi cảnh báo mức Thấp — giảm cảm giác quá tải (docs/rules/07). */
export function AcknowledgeLowButton({ termId }: { termId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => {
        setPending(true);
        void acknowledgeLowAlertsAction({ termId }).then((r) => {
          setPending(false);
          if (!r.ok) return toast.error(r.message);
          toast.success(`Đã đánh dấu đã xem ${r.data} cảnh báo mức Thấp`);
          router.refresh();
        });
      }}
    >
      <CheckCheck aria-hidden />
      Đánh dấu đã xem mức Thấp
    </Button>
  );
}
