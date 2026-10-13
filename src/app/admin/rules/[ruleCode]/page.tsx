import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ConditionEditor } from '@/components/rules/condition-editor';
import { RuleConfigurator } from '@/components/rules/rule-configurator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RuleStatus, UserRole } from '@/db/enums';
import { requireUser } from '@/lib/auth-server';
import { formatVnDateTime } from '@/lib/dates';
import {
  RULE_DESCRIPTIONS,
  RULE_GROUP_LABELS,
  RULE_STATUS_LABELS,
} from '@/modules/rule-engine/labels';
import { getRuleDetail } from '@/modules/rule-engine/services/rule-query.service';

export const metadata: Metadata = { title: 'Cấu hình luật' };

export default async function RuleDetailPage({
  params,
}: {
  params: Promise<{ ruleCode: string }>;
}) {
  await requireUser([UserRole.ADMIN]);
  const ruleCode = decodeURIComponent((await params).ruleCode).slice(0, 20);
  const rule = await getRuleDetail(ruleCode);
  if (!rule) notFound();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/admin/rules">
            <ArrowLeft aria-hidden />
            Cấu hình luật
          </Link>
        </Button>
        <h1 className="mt-2">
          {rule.ruleCode} · {rule.ruleName}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {RULE_GROUP_LABELS[rule.ruleGroup]} · {RULE_DESCRIPTIONS[rule.ruleCode]}
        </p>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>
            Đang áp dụng {rule.active ? `· phiên bản ${rule.active.version}` : ''}
          </CardTitle>
          <CardDescription>
            {rule.active
              ? `Từ ${formatVnDateTime(rule.active.effectiveFrom)}, cấu hình bởi ${rule.active.configuredBy}.`
              : 'Chưa có phiên bản đang áp dụng.'}
          </CardDescription>
        </CardHeader>
        {rule.active && (
          <CardContent>
            <ConditionEditor
              ruleCode={rule.ruleCode}
              schema={rule.schema}
              value={rule.active.condition}
              readOnly
            />
          </CardContent>
        )}
      </Card>

      <RuleConfigurator rule={rule} />

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Lịch sử phiên bản</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Phiên bản</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Người cấu hình</TableHead>
                  <TableHead>Hiệu lực</TableHead>
                  <TableHead>Chạy thử gần nhất</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rule.versions.map((v) => (
                  <TableRow key={v.id} className="even:bg-muted">
                    <TableCell className="font-medium tabular-nums">v{v.version}</TableCell>
                    <TableCell>
                      <Badge variant={v.status === RuleStatus.ACTIVE ? 'default' : 'outline'}>
                        {RULE_STATUS_LABELS[v.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{v.configuredBy}</TableCell>
                    <TableCell className="tabular-nums">
                      {v.status === RuleStatus.DRAFT || v.status === RuleStatus.ARCHIVED
                        ? '—'
                        : `${formatVnDateTime(v.effectiveFrom)}${v.effectiveTo ? ` → ${formatVnDateTime(v.effectiveTo)}` : ''}`}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {v.lastDryRunAt ? formatVnDateTime(v.lastDryRunAt) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
