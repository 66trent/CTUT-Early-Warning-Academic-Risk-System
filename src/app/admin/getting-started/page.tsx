import type { Metadata } from 'next';
import { ArrowRight, CheckCircle2, Circle, Lock } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserRole } from '@/db/enums';
import { requireUser } from '@/lib/auth-server';
import { stepAnchor } from '@/lib/help-links';
import { cn } from '@/lib/utils';
import { getSetupSteps } from '@/modules/admin/services/getting-started.service';
import {
  SETUP_PHASE_LABELS,
  type SetupPhase,
  type SetupStep,
} from '@/modules/admin/services/setup-steps';

export const metadata: Metadata = { title: 'Bắt đầu' };

const PHASES: SetupPhase[] = ['FOUNDATION', 'TERM', 'DURING_TERM', 'END_OF_TERM'];

function StepIcon({ step }: { step: SetupStep }) {
  if (step.done) return <CheckCircle2 aria-hidden className="size-5 shrink-0 text-primary" />;
  if (step.blockedReason) {
    return <Lock aria-hidden className="size-5 shrink-0 text-muted-foreground" />;
  }
  return <Circle aria-hidden className="size-5 shrink-0 text-muted-foreground" />;
}

function StepRow({ step, index }: { step: SetupStep; index: number }) {
  return (
    <li
      id={stepAnchor(step.key)}
      className={cn(
        'flex scroll-mt-20 flex-col gap-3 rounded-md border p-4 target:ring-2 target:ring-primary sm:flex-row sm:items-center',
        step.next && 'border-primary bg-primary-soft',
      )}
    >
      <div className="flex flex-1 items-start gap-3">
        <StepIcon step={step} />
        <div className="flex flex-col gap-1">
          <p className="font-medium">
            <span className="tabular-nums">{index}.</span> {step.title}
            {step.next && <Badge className="ml-2">Bước tiếp theo</Badge>}
            <span className="sr-only">{step.done ? ' — đã xong' : ' — chưa xong'}</span>
          </p>
          <p className="text-sm text-muted-foreground">{step.description}</p>
          <p className="text-sm">{step.status}</p>
          {step.blockedReason && !step.done && (
            <p className="text-sm text-muted-foreground">Chưa làm được: {step.blockedReason}</p>
          )}
        </div>
      </div>
      {step.blockedReason && !step.done ? (
        <Button variant="outline" size="sm" disabled>
          {step.actionLabel}
        </Button>
      ) : (
        <Button asChild variant={step.next ? 'default' : 'outline'} size="sm">
          <Link href={step.href}>
            {step.actionLabel}
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      )}
    </li>
  );
}

/** Checklist vận hành theo đúng thứ tự dữ liệu bắt buộc (docs/rules/00, 07). */
export default async function GettingStartedPage() {
  await requireUser([UserRole.ADMIN]);
  const steps = await getSetupSteps();
  const done = steps.filter((s) => s.done).length;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        title="Bắt đầu"
        description={`Làm theo thứ tự dưới đây — mỗi bước cần dữ liệu của bước trước. Đã xong ${done}/${steps.length} bước; trang tự đánh dấu khi đã có dữ liệu.`}
      />
      {PHASES.map((phase) => {
        const items = steps.filter((s) => s.phase === phase);
        return (
          <Card key={phase} className="shadow-sm">
            <CardHeader>
              <CardTitle>{SETUP_PHASE_LABELS[phase]}</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-3">
                {items.map((step) => (
                  <StepRow key={step.key} step={step} index={steps.indexOf(step) + 1} />
                ))}
              </ol>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
