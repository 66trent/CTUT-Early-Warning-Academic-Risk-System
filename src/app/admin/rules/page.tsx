import type { Metadata } from 'next';
import Link from 'next/link';
import { SeverityBadge } from '@/components/domain/severity-badge';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { UserRole } from '@/db/enums';
import { requireUser } from '@/lib/auth-server';
import { formatVnDate } from '@/lib/dates';
import { RULE_DESCRIPTIONS, RULE_GROUP_LABELS } from '@/modules/rule-engine/labels';
import { listRules } from '@/modules/rule-engine/services/rule-query.service';

export const metadata: Metadata = { title: 'Cấu hình luật' };

export default async function RulesPage() {
  await requireUser([UserRole.ADMIN]);
  const rules = await listRules();
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        title="Cấu hình luật"
        description="12 luật cảnh báo và cấu hình điểm rủi ro. Sửa ngưỡng tạo phiên bản mới, phải chạy thử rồi mới kích hoạt."
      />
      <Card className="shadow-sm">
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Luật</TableHead>
                  <TableHead>Nhóm</TableHead>
                  <TableHead>Phiên bản đang áp dụng</TableHead>
                  <TableHead>Mức cao nhất</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Chưa có luật — chạy npm run seed.
                    </TableCell>
                  </TableRow>
                )}
                {rules.map((r) => (
                  <TableRow key={r.ruleCode} className="even:bg-muted">
                    <TableCell className="min-w-72 whitespace-normal">
                      <Link
                        href={`/admin/rules/${r.ruleCode}`}
                        className="font-medium text-primary hover:underline"
                      >
                        <span className="tabular-nums">{r.ruleCode}</span> · {r.ruleName}
                      </Link>
                      <span className="block text-xs text-muted-foreground">
                        {RULE_DESCRIPTIONS[r.ruleCode]}
                      </span>
                    </TableCell>
                    <TableCell>{RULE_GROUP_LABELS[r.ruleGroup]}</TableCell>
                    <TableCell className="tabular-nums">
                      {r.activeVersion ? (
                        <>
                          v{r.activeVersion}
                          <span className="block text-xs text-muted-foreground">
                            từ {formatVnDate(r.activeSince ?? '')}
                          </span>
                        </>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      {r.activeSeverity && r.ruleCode !== 'RISK-SCORE' ? (
                        <SeverityBadge severity={r.activeSeverity} />
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      {r.hasDraft && <Badge variant="outline">Có bản nháp</Badge>}
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
