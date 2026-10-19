import type { Metadata } from 'next';
import { PageHeader } from '@/components/page-header';
import { RulesTable } from '@/components/rules/rules-table';
import { Card, CardContent } from '@/components/ui/card';
import { UserRole } from '@/db/enums';
import { requireUser } from '@/lib/auth-server';
import { HELP_LINKS } from '@/lib/help-links';
import { RISK_SCORE_RULE_CODE } from '@/modules/rule-engine/evaluator/config';
import { RULE_DESCRIPTIONS, RULE_GROUP_LABELS } from '@/modules/rule-engine/labels';
import { listRules } from '@/modules/rule-engine/services/rule-query.service';

export const metadata: Metadata = { title: 'Cấu hình luật' };

export default async function RulesPage() {
  await requireUser([UserRole.ADMIN]);
  const rules = await listRules();
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        helpHref={HELP_LINKS.rules}
        title="Cấu hình luật"
        description="12 luật cảnh báo và cấu hình điểm rủi ro. Sửa ngưỡng tạo phiên bản mới, phải chạy thử rồi mới kích hoạt."
      />
      <Card className="shadow-sm">
        <CardContent>
          <RulesTable
            rules={rules.map((r) => ({
              ruleCode: r.ruleCode,
              ruleName: r.ruleName,
              description: RULE_DESCRIPTIONS[r.ruleCode] ?? '',
              groupLabel: RULE_GROUP_LABELS[r.ruleGroup],
              activeVersion: r.activeVersion,
              activeSince: r.activeSince,
              activeSeverity: r.ruleCode === RISK_SCORE_RULE_CODE ? null : r.activeSeverity,
              hasDraft: r.hasDraft,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
