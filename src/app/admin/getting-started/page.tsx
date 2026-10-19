import type { Metadata } from 'next';
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Download,
  Lightbulb,
  ListChecks,
  Lock,
} from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { UserRole } from '@/db/enums';
import { requireUser } from '@/lib/auth-server';
import { stepAnchor } from '@/lib/help-links';
import { cn } from '@/lib/utils';
import {
  GETTING_STARTED_FAQ,
  PHASE_INTROS,
  STEP_GUIDES,
} from '@/modules/admin/services/getting-started-content';
import { getSetupSteps } from '@/modules/admin/services/getting-started.service';
import {
  SETUP_PHASE_LABELS,
  type SetupPhase,
  type SetupStep,
} from '@/modules/admin/services/setup-steps';
import { availableImportTypes } from '@/modules/data-import/types/registry';

export const metadata: Metadata = { title: 'Bắt đầu' };

const PHASES: SetupPhase[] = ['FOUNDATION', 'TERM', 'DURING_TERM', 'END_OF_TERM'];
const phaseAnchor = (phase: SetupPhase) => `phan-${phase.toLowerCase().replace('_', '-')}`;

type Templates = Map<string, { label: string; xlsx: string; csv: string }>;

function StepIcon({ step }: { step: SetupStep }) {
  if (step.done) return <CheckCircle2 aria-hidden className="size-5 shrink-0 text-primary" />;
  if (step.blockedReason) {
    return <Lock aria-hidden className="size-5 shrink-0 text-muted-foreground" />;
  }
  return <Circle aria-hidden className="size-5 shrink-0 text-muted-foreground" />;
}

function StepState({ step }: { step: SetupStep }) {
  if (step.next) return <Badge>Bước tiếp theo</Badge>;
  if (step.done) return <Badge variant="secondary">Đã xong</Badge>;
  if (step.blockedReason) return <Badge variant="outline">Chưa mở</Badge>;
  return <Badge variant="outline">Cần làm</Badge>;
}

function StepAction({ step }: { step: SetupStep }) {
  if (step.blockedReason && !step.done) {
    return (
      <Button variant="outline" size="sm" disabled className="shrink-0">
        {step.actionLabel}
      </Button>
    );
  }
  return (
    <Button asChild variant={step.next ? 'default' : 'outline'} size="sm" className="shrink-0">
      <Link href={step.href}>
        {step.actionLabel}
        <ArrowRight aria-hidden />
      </Link>
    </Button>
  );
}

function StepGuideBody({ step, templates }: { step: SetupStep; templates: Templates }) {
  const guide = STEP_GUIDES[step.key];
  if (!guide) return null;
  return (
    <div className="grid gap-4 pt-3 text-sm md:grid-cols-2">
      <div>
        <p className="mb-1 font-medium">Làm gì</p>
        <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
          {guide.what.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ol>
      </div>
      <div className="flex flex-col gap-3">
        <div>
          <p className="mb-1 font-medium">Vì sao cần</p>
          <p className="text-muted-foreground">{guide.why}</p>
        </div>
        {guide.templates && (
          <div>
            <p className="mb-1 font-medium">Cần chuẩn bị</p>
            <div className="flex flex-wrap gap-2">
              {guide.templates.map((t) => {
                const tpl = templates.get(t);
                if (!tpl) return null;
                return (
                  <span key={t} className="inline-flex items-center gap-1">
                    <Button asChild size="sm" variant="outline">
                      <a href={tpl.xlsx} download>
                        <Download aria-hidden />
                        Mẫu {tpl.label}
                      </a>
                    </Button>
                    <a
                      href={tpl.csv}
                      download
                      className="text-xs text-muted-foreground underline underline-offset-2"
                    >
                      CSV
                    </a>
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {guide.tip && (
        <p className="flex gap-2 rounded-md bg-muted px-3 py-2 text-muted-foreground md:col-span-2">
          <Lightbulb aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-600" />
          {guide.tip}
        </p>
      )}
    </div>
  );
}

function StepCard({
  step,
  index,
  templates,
}: {
  step: SetupStep;
  index: number;
  templates: Templates;
}) {
  return (
    <li
      id={stepAnchor(step.key)}
      className={cn(
        'scroll-mt-20 rounded-lg border bg-card p-4 target:ring-2 target:ring-primary',
        step.next && 'border-primary bg-primary-soft',
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex flex-1 items-start gap-3">
          <StepIcon step={step} />
          <div className="flex min-w-0 flex-col gap-1">
            <p className="flex flex-wrap items-center gap-2 font-medium">
              <span>
                <span className="tabular-nums">{index}.</span> {step.title}
              </span>
              <StepState step={step} />
            </p>
            <p className="text-sm text-muted-foreground">{step.description}</p>
            <p className="text-sm">{step.status}</p>
            {step.blockedReason && !step.done && (
              <p className="text-sm text-muted-foreground">
                <Lock aria-hidden className="mr-1 inline size-3.5" />
                Chưa làm được: {step.blockedReason}
              </p>
            )}
          </div>
        </div>
        <StepAction step={step} />
      </div>
      <details open={!step.done} className="group mt-2 pl-8">
        <summary className="cursor-pointer text-sm font-medium text-primary select-none hover:underline">
          <span className="group-open:hidden">Xem hướng dẫn</span>
          <span className="hidden group-open:inline">Thu gọn hướng dẫn</span>
        </summary>
        <StepGuideBody step={step} templates={templates} />
      </details>
    </li>
  );
}

/**
 * Hướng dẫn vận hành theo đúng thứ tự dữ liệu bắt buộc (docs/rules/00, 07): mỗi bước có việc cần
 * làm, lý do, file mẫu, trạng thái thật từ dữ liệu.
 */
export default async function GettingStartedPage() {
  await requireUser([UserRole.ADMIN]);
  const steps = await getSetupSteps();
  const done = steps.filter((s) => s.done).length;
  const next = steps.find((s) => s.next) ?? null;
  const templates: Templates = new Map(
    availableImportTypes().map((t) => [
      t.dataType,
      { label: t.label, csv: t.templatePath, xlsx: t.templatePath.replace(/\.csv$/, '.xlsx') },
    ]),
  );

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        title="Bắt đầu"
        description="Hướng dẫn vận hành hệ thống theo thứ tự. Mỗi bước cần dữ liệu của bước trước; trang tự đánh dấu khi đã có dữ liệu."
      />

      <Card className="shadow-sm">
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Tiến độ thiết lập</span>
              <span className="text-muted-foreground tabular-nums">
                Đã xong {done}/{steps.length} bước
              </span>
            </div>
            <Progress value={(done / steps.length) * 100} aria-label="Tiến độ thiết lập" />
          </div>
          {next ? (
            <div className="flex flex-col gap-3 rounded-lg border border-primary bg-primary-soft p-4 sm:flex-row sm:items-center">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Bước tiếp theo</p>
                <p className="font-medium">{next.title}</p>
                <p className="text-sm text-muted-foreground">{next.status}</p>
              </div>
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm">
                  <a href={`#${stepAnchor(next.key)}`}>Xem hướng dẫn</a>
                </Button>
                <StepAction step={next} />
              </div>
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm">
              <CheckCircle2 aria-hidden className="size-4 text-primary" />
              Đã thiết lập xong. Hằng tuần lặp lại phần &ldquo;Hằng tuần&rdquo;.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Mục lục" className="hidden lg:block">
          <div className="sticky top-20 flex flex-col gap-1 text-sm">
            <p className="mb-1 flex items-center gap-2 font-medium">
              <ListChecks aria-hidden className="size-4" /> Mục lục
            </p>
            {PHASES.map((phase, i) => {
              const items = steps.filter((s) => s.phase === phase);
              return (
                <a
                  key={phase}
                  href={`#${phaseAnchor(phase)}`}
                  className="flex justify-between rounded-md px-2 py-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <span>
                    {i + 1}. {SETUP_PHASE_LABELS[phase]}
                  </span>
                  <span className="tabular-nums">
                    {items.filter((s) => s.done).length}/{items.length}
                  </span>
                </a>
              );
            })}
            <a
              href="#hoi-dap"
              className="rounded-md px-2 py-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              Hỏi đáp
            </a>
          </div>
        </nav>

        <div className="flex min-w-0 flex-col gap-8">
          {PHASES.map((phase, i) => {
            const items = steps.filter((s) => s.phase === phase);
            return (
              <section key={phase} id={phaseAnchor(phase)} className="scroll-mt-20">
                <div className="mb-3 flex items-start gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {i + 1}
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold">{SETUP_PHASE_LABELS[phase]}</h2>
                    <p className="text-sm text-muted-foreground">{PHASE_INTROS[phase]}</p>
                  </div>
                </div>
                <ol className="flex flex-col gap-3">
                  {items.map((step) => (
                    <StepCard
                      key={step.key}
                      step={step}
                      index={steps.indexOf(step) + 1}
                      templates={templates}
                    />
                  ))}
                </ol>
              </section>
            );
          })}

          <Card id="hoi-dap" className="scroll-mt-20 shadow-sm">
            <CardHeader>
              <CardTitle>Hỏi đáp</CardTitle>
              <CardDescription>Các câu hay gặp khi vận hành.</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple">
                {GETTING_STARTED_FAQ.map((f, i) => (
                  <AccordionItem key={f.question} value={`faq-${i}`}>
                    <AccordionTrigger>{f.question}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      {f.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
