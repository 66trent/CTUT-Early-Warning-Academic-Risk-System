import { In, type EntityManager } from 'typeorm';
import { type Alert } from '@/db/entities/alert.entity';
import { RuleTrigger } from '@/db/entities/rule-trigger.entity';

/**
 * "Dấu hiệu hiện tại" của cảnh báo = các RuleTrigger trong `Alert.currentTriggerIds` — được cập
 * nhật khi gộp cảnh báo (lần chạy cả học kỳ thay toàn bộ trừ dấu hiệu điểm danh quá hạn; lần chạy
 * theo học phần chỉ thay học phần đó — docs/rules/08). Dùng chung cho màn hình, email, trang sinh viên.
 */
export async function loadCurrentTriggers(
  em: EntityManager,
  alerts: readonly Pick<Alert, 'alertId' | 'currentTriggerIds'>[],
): Promise<Map<string, RuleTrigger[]>> {
  const ids = alerts.flatMap((a) => a.currentTriggerIds);
  const triggers = ids.length === 0 ? [] : await em.find(RuleTrigger, { where: { id: In(ids) } });
  const byId = new Map(triggers.map((t) => [t.id, t]));
  return new Map(
    alerts.map((a) => [
      a.alertId,
      a.currentTriggerIds.map((id) => byId.get(id)).filter((t): t is RuleTrigger => !!t),
    ]),
  );
}
