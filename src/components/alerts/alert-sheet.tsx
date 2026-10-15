'use client';

import { Loader2, Lock } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertStatusBadge } from '@/components/domain/alert-status-badge';
import { ReferenceOnlyNotice } from '@/components/domain/reference-only-notice';
import { SeverityBadge } from '@/components/domain/severity-badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { type AlertStatus } from '@/db/enums';
import { formatVnDate, formatVnDateTime } from '@/lib/dates';
import { ALERT_STATUS_LABELS } from '@/lib/labels';
import {
  changeAlertStatusAction,
  getAlertDetailAction,
  getTriggerEvidenceAction,
} from '@/modules/alerts/actions/alert.actions';
import {
  INTERVENTION_STATUS_LABELS,
  INTERVENTION_TYPE_LABELS,
  NEEDS_REASON,
  TRANSITION_LABELS,
} from '@/modules/alerts/labels';
import type { AlertDetailDto } from '@/modules/alerts/services/alert-query.service';
import { InterventionForm } from './intervention-form';
import { SignalsClearedNote } from './signals-cleared-note';

interface AlertSheetProps {
  alertId: string | null;
  /** Đường dẫn hồ sơ sinh viên theo vai trò (`/advisor/students` hoặc `/admin/students`). */
  profileBase: string;
  onClose: () => void;
}

/** Bằng chứng chi tiết — chỉ tải khi mở mục (docs/rules/05). */
function Evidence({ triggerId }: { triggerId: string }) {
  const [rows, setRows] = useState<{ label: string; value: string }[] | null>(null);
  useEffect(() => {
    void getTriggerEvidenceAction({ triggerId }).then((r) => setRows(r.ok ? r.data : []));
  }, [triggerId]);
  if (!rows) return <Loader2 aria-label="Đang tải" className="size-4 animate-spin" />;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      {rows.map((r) => (
        <div key={r.label} className="contents">
          <dt className="text-muted-foreground">{r.label}</dt>
          <dd className="tabular-nums">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function StatusActions({ detail, onDone }: { detail: AlertDetailDto; onDone: () => void }) {
  const [pending, setPending] = useState<AlertStatus | null>(null);
  const [reasonFor, setReasonFor] = useState<AlertStatus | null>(null);
  const [reason, setReason] = useState('');

  const run = async (to: AlertStatus) => {
    setPending(to);
    const result = await changeAlertStatusAction({ alertId: detail.alertId, toStatus: to, reason });
    setPending(null);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(`Đã chuyển sang "${ALERT_STATUS_LABELS[to]}"`);
    setReasonFor(null);
    setReason('');
    onDone();
  };

  if (detail.allowedTransitions.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {detail.allowedTransitions.map((to, i) => (
          <Button
            key={to}
            size="sm"
            variant={i === 0 ? 'default' : 'outline'}
            disabled={pending !== null}
            onClick={() => (NEEDS_REASON.includes(to) ? setReasonFor(to) : void run(to))}
          >
            {pending === to && <Loader2 className="animate-spin" />}
            {TRANSITION_LABELS[to]}
          </Button>
        ))}
      </div>
      {reasonFor && (
        <div className="flex flex-col gap-2 rounded-md border p-3">
          <label htmlFor="alert-reason" className="text-sm font-medium">
            Lý do {TRANSITION_LABELS[reasonFor]?.toLowerCase()}
          </label>
          <Textarea
            id="alert-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="VD: số liệu điểm danh nhập nhầm, đã xác minh với giảng viên."
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!reason.trim() || pending !== null}
              onClick={() => void run(reasonFor)}
            >
              Xác nhận
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setReasonFor(null)}>
              Hủy
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Chi tiết cảnh báo trong Sheet (docs/rules/07): Ai — Vì sao (tóm tắt trước, mở rộng xem số liệu)
 * — Cần làm gì (xác nhận + ghi can thiệp ngay tại chỗ, ≤ 2 click từ danh sách).
 */
export function AlertSheet({ alertId, profileBase, onClose }: AlertSheetProps) {
  const router = useRouter();
  const [detail, setDetail] = useState<AlertDetailDto | null>(null);

  const [version, setVersion] = useState(0);

  // Mỗi cảnh báo 1 instance (key = alertId ở AlertsTable); `version` tăng để tải lại sau thao tác.
  useEffect(() => {
    if (!alertId) return;
    let active = true;
    void getAlertDetailAction({ alertId }).then((result) => {
      if (!active) return;
      if (!result.ok) {
        toast.error(result.message);
        onClose();
        return;
      }
      setDetail(result.data);
    });
    return () => {
      active = false;
    };
  }, [alertId, onClose, version]);

  const refresh = () => {
    setVersion((v) => v + 1);
    router.refresh();
  };
  const canProcess = detail ? detail.allowedTransitions.length > 0 : false;

  return (
    <Sheet open={alertId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {!detail ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 aria-label="Đang tải" className="animate-spin" />
          </div>
        ) : (
          <div className="flex flex-col gap-5 px-4 pb-6">
            <SheetHeader className="px-0">
              <SheetTitle>
                {detail.studentName} · {detail.studentId}
              </SheetTitle>
              <SheetDescription>
                Lớp {detail.classId} · {detail.termName} · phát hiện lần đầu{' '}
                {formatVnDate(detail.firstDetectedAt)}
              </SheetDescription>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <SeverityBadge severity={detail.severity} />
                <AlertStatusBadge status={detail.status} />
              </div>
            </SheetHeader>
            <ReferenceOnlyNotice />
            {detail.signalsClearedAt && <SignalsClearedNote at={detail.signalsClearedAt} />}

            <section className="flex flex-col gap-2">
              <h3 className="font-semibold">{detail.summary}</h3>
              <Accordion type="multiple" className="rounded-md border px-3">
                {detail.groups.flatMap((g) =>
                  g.signals.map((s) => (
                    <AccordionItem key={s.triggerId} value={s.triggerId}>
                      <AccordionTrigger className="text-left">
                        <span className="flex flex-col gap-1">
                          <span className="flex flex-wrap items-center gap-2 text-sm">
                            <SeverityBadge severity={s.severity} />
                            <span className="font-medium">{g.label}</span>
                            <span className="text-muted-foreground">· {s.courseLabel}</span>
                          </span>
                          <span className="text-sm font-normal">{s.reason}</span>
                          <span className="text-xs font-normal text-muted-foreground">
                            {s.ruleCode} · {s.ruleName} · số liệu ngày {formatVnDate(s.dataDate)}
                          </span>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <Evidence triggerId={s.triggerId} />
                      </AccordionContent>
                    </AccordionItem>
                  )),
                )}
              </Accordion>
              {detail.closedReason && (
                <p className="text-sm text-muted-foreground">Lý do đóng: {detail.closedReason}</p>
              )}
            </section>

            <StatusActions detail={detail} onDone={refresh} />
            {canProcess && <InterventionForm alertId={detail.alertId} onSaved={refresh} />}

            <section className="flex flex-col gap-2">
              <h3 className="font-semibold">Can thiệp đã ghi ({detail.interventions.length})</h3>
              {detail.interventions.length === 0 && (
                <p className="text-sm text-muted-foreground">Chưa ghi nhận can thiệp nào.</p>
              )}
              {detail.interventions.map((i) => (
                <div key={i.interventionId} className="rounded-md border p-3 text-sm">
                  <p className="font-medium">
                    {INTERVENTION_TYPE_LABELS[i.type]} · {formatVnDateTime(i.performedAt)} ·{' '}
                    {i.performedBy} · {INTERVENTION_STATUS_LABELS[i.status] ?? i.status}
                  </p>
                  {i.content === null ? (
                    <p className="mt-1 flex items-center gap-1 text-muted-foreground">
                      <Lock aria-hidden className="size-3.5" /> Nội dung bảo mật — chỉ Cố vấn học
                      tập phụ trách xem được.
                    </p>
                  ) : (
                    <p className="mt-1 whitespace-pre-wrap">{i.content}</p>
                  )}
                  {i.outcome && <p className="mt-1 text-muted-foreground">Kết quả: {i.outcome}</p>}
                  {i.nextFollowUpAt && (
                    <p className="mt-1 text-muted-foreground">
                      Hẹn theo dõi: {formatVnDate(i.nextFollowUpAt)}
                    </p>
                  )}
                </div>
              ))}
            </section>

            <section className="flex flex-col gap-1 text-sm">
              <h3 className="font-semibold">Lịch sử</h3>
              {detail.history.map((h, idx) => (
                <p key={idx} className="text-muted-foreground">
                  {formatVnDateTime(h.changedAt)} ·{' '}
                  {h.fromStatus ? `${ALERT_STATUS_LABELS[h.fromStatus]} → ` : ''}
                  {ALERT_STATUS_LABELS[h.toStatus]} · {h.changedBy ?? 'Hệ thống'}
                  {h.reason ? ` — ${h.reason}` : ''}
                </p>
              ))}
            </section>

            <Button asChild variant="outline" size="sm" className="self-start">
              <Link href={`${profileBase}/${detail.studentId}?term=${detail.termId}`}>
                Xem hồ sơ học tập theo học phần
              </Link>
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
