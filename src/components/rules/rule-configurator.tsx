'use client';

import { CheckCircle2, FlaskConical, Loader2, Play, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmActionButton } from '@/components/confirm-action-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatVnDateTime } from '@/lib/dates';
import { requestEvaluationAction } from '@/modules/rule-engine/actions/evaluation.actions';
import {
  activateRuleVersionAction,
  createRuleVersionAction,
  discardRuleVersionAction,
  dryRunRuleVersionAction,
} from '@/modules/rule-engine/actions/rule.actions';
import { type ConditionValue, flattenCondition } from '@/modules/rule-engine/condition-schema';
import type { DryRunResultDto } from '@/modules/rule-engine/services/dry-run.service';
import type { RuleDetailDto } from '@/modules/rule-engine/services/rule-query.service';
import { ConditionEditor } from './condition-editor';
import { DryRunResult } from './dry-run-result';

/** Các giá trị bản nháp khác bản đang áp dụng — để Admin kiểm lại trước khi kích hoạt. */
function changedPaths(active: ConditionValue | undefined, draft: ConditionValue): string[] {
  const before = new Map(active ? flattenCondition(active).map((f) => [f.path, f.value]) : []);
  const after = flattenCondition(draft);
  const changed = after.filter((f) => before.get(f.path) !== f.value).map((f) => f.path);
  const removed = [...before.keys()].filter((p) => !after.some((f) => f.path === p));
  return [...changed, ...removed];
}

/** Đã kích hoạt → gợi ý chạy đánh giá ngay trên học kỳ hiện tại (docs/implement.md Phase 6). */
function RunNowSuggestion({ version, termId }: { version: number; termId: string | undefined }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const run = async () => {
    if (!termId) return;
    setPending(true);
    const result = await requestEvaluationAction({ termId, courseId: '', asOfDate: '' });
    setPending(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    router.push(`/admin/evaluations/${result.data.runId}`);
  };
  return (
    <Card className="border-primary/30 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 aria-hidden className="size-5 text-primary" />
          Đã kích hoạt phiên bản {version}
        </CardTitle>
        <CardDescription>
          Phiên bản mới áp dụng từ lần chạy đánh giá kế tiếp. Chạy ngay để cập nhật cảnh báo theo
          ngưỡng mới.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={() => void run()} disabled={pending || !termId}>
          {pending ? <Loader2 className="animate-spin" /> : <Play aria-hidden />}
          Chạy đánh giá ngay (học kỳ hiện tại)
        </Button>
        {!termId && <p className="mt-2 text-sm text-muted-foreground">Chưa đặt học kỳ hiện tại.</p>}
      </CardContent>
    </Card>
  );
}

function DraftPanel({ rule }: { rule: RuleDetailDto }) {
  const draft = rule.draft;
  const current = rule.terms.find((t) => t.isCurrent) ?? rule.terms[0];
  const [termId, setTermId] = useState(current?.termId ?? '');
  const [asOfDate, setAsOfDate] = useState('');
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<DryRunResultDto | null>(null);
  const changes = useMemo(
    () => (draft ? changedPaths(rule.active?.condition, draft.condition) : []),
    [draft, rule.active],
  );
  if (!draft) return null;
  const dryRunDone = Boolean(result ?? draft.lastDryRunAt);

  const dryRun = async () => {
    setPending(true);
    const res = await dryRunRuleVersionAction({ versionId: draft.id, termId, asOfDate });
    setPending(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    setResult(res.data);
  };

  return (
    <div className="flex flex-col gap-6">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Bản nháp phiên bản {draft.version}</CardTitle>
          <CardDescription>
            Tạo bởi {draft.configuredBy}.{' '}
            {changes.length > 0
              ? `Thay đổi so với bản đang áp dụng: ${changes.length} giá trị.`
              : 'Giống bản đang áp dụng.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConditionEditor
            ruleCode={rule.ruleCode}
            schema={rule.schema}
            value={draft.condition}
            readOnly
          />
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Bước 2 · Chạy thử</CardTitle>
          <CardDescription>
            Tính thử trên dữ liệu thật của 1 học kỳ để ước tính số sinh viên bị ảnh hưởng. Bắt buộc
            trước khi kích hoạt.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form
            className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              void dryRun();
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="dry-term">Học kỳ</Label>
              <Select value={termId} onValueChange={setTermId}>
                <SelectTrigger id="dry-term" className="w-full">
                  <SelectValue placeholder="Chọn học kỳ" />
                </SelectTrigger>
                <SelectContent>
                  {rule.terms.map((t) => (
                    <SelectItem key={t.termId} value={t.termId}>
                      {t.termName}
                      {t.isCurrent ? ' (hiện tại)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {rule.canChooseAsOf ? (
              <div className="grid gap-2">
                <Label htmlFor="dry-as-of">Mốc dữ liệu (chế độ demo, để trống = bây giờ)</Label>
                <Input
                  id="dry-as-of"
                  type="date"
                  value={asOfDate}
                  onChange={(e) => setAsOfDate(e.target.value)}
                />
              </div>
            ) : (
              <div />
            )}
            <Button type="submit" disabled={pending || !termId}>
              {pending ? <Loader2 className="animate-spin" /> : <FlaskConical aria-hidden />}
              Chạy thử
            </Button>
          </form>
          {result ? (
            <DryRunResult result={result} />
          ) : (
            draft.lastDryRunAt && (
              <p className="text-sm text-muted-foreground">
                Đã chạy thử lúc {formatVnDateTime(draft.lastDryRunAt)}.
              </p>
            )
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Bước 3 · Kích hoạt</CardTitle>
          <CardDescription>
            {dryRunDone
              ? 'Bản đang áp dụng sẽ chuyển sang "Đã thay thế". Cảnh báo cũ giữ nguyên; lần chạy đánh giá sau dùng ngưỡng mới.'
              : 'Hãy chạy thử trước khi kích hoạt.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {dryRunDone ? (
            <ConfirmActionButton
              trigger="Kích hoạt phiên bản này"
              triggerVariant="default"
              title={`Kích hoạt ${rule.ruleCode} phiên bản ${draft.version}?`}
              description="Từ lần chạy đánh giá kế tiếp, hệ thống dùng ngưỡng của phiên bản này. Thao tác được ghi vào nhật ký hệ thống."
              confirmLabel="Kích hoạt"
              successMessage={`Đã kích hoạt ${rule.ruleCode} phiên bản ${draft.version}.`}
              onConfirm={() => activateRuleVersionAction({ versionId: draft.id })}
            />
          ) : (
            <Button size="sm" disabled>
              Kích hoạt phiên bản này
            </Button>
          )}
          <ConfirmActionButton
            trigger="Bỏ bản nháp"
            title="Bỏ bản nháp này?"
            description="Bản nháp được giữ trong lịch sử với trạng thái 'Đã bỏ', không áp dụng."
            confirmLabel="Bỏ bản nháp"
            successMessage="Đã bỏ bản nháp."
            destructive
            onConfirm={() => discardRuleVersionAction({ versionId: draft.id })}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function NewDraftForm({ rule }: { rule: RuleDetailDto }) {
  const [value, setValue] = useState<ConditionValue>(rule.active?.condition ?? {});
  const [pending, setPending] = useState(false);
  const save = async () => {
    setPending(true);
    const res = await createRuleVersionAction({ ruleCode: rule.ruleCode, condition: value });
    setPending(false);
    if (!res.ok) toast.error(res.message);
    else toast.success('Đã lưu bản nháp. Hãy chạy thử trước khi kích hoạt.');
  };
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Bước 1 · Sửa ngưỡng và lưu bản nháp</CardTitle>
        <CardDescription>
          Sửa ngưỡng luôn tạo phiên bản mới — phiên bản đang áp dụng không bị ghi đè.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ConditionEditor
          ruleCode={rule.ruleCode}
          schema={rule.schema}
          value={value}
          onChange={setValue}
        />
        <Button className="self-start" onClick={() => void save()} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Save aria-hidden />}
          Lưu bản nháp
        </Button>
      </CardContent>
    </Card>
  );
}

/** Quy trình cấu hình 1 luật: bản nháp → chạy thử → kích hoạt → gợi ý chạy đánh giá. */
export function RuleConfigurator({ rule }: { rule: RuleDetailDto }) {
  const [activated, setActivated] = useState<number | null>(null);
  const currentTerm = rule.terms.find((t) => t.isCurrent)?.termId;
  // Bản nháp vừa biến mất và bản ACTIVE là bản nháp cũ → vừa kích hoạt xong.
  const [lastDraft, setLastDraft] = useState(rule.draft?.version ?? null);
  if (lastDraft !== (rule.draft?.version ?? null)) {
    if (lastDraft !== null && rule.active?.version === lastDraft) setActivated(lastDraft);
    setLastDraft(rule.draft?.version ?? null);
  }
  return (
    <div className="flex flex-col gap-6">
      {activated !== null && <RunNowSuggestion version={activated} termId={currentTerm} />}
      {rule.draft ? (
        <DraftPanel key={rule.draft.id} rule={rule} />
      ) : (
        <NewDraftForm key={rule.active?.id ?? 'none'} rule={rule} />
      )}
    </div>
  );
}
