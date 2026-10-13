'use client';

import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ConfidentialityLevel, INTERVENTION_STATUSES, InterventionType } from '@/db/enums';
import { recordInterventionAction } from '@/modules/alerts/actions/alert.actions';
import {
  CONFIDENTIALITY_LABELS,
  INTERVENTION_STATUS_LABELS,
  INTERVENTION_TYPE_LABELS,
} from '@/modules/alerts/labels';

/** Ghi can thiệp ngay trong Sheet (docs/rules/07) — ghi xong cảnh báo tự sang "Đang xử lý". */
export function InterventionForm({ alertId, onSaved }: { alertId: string; onSaved: () => void }) {
  const [type, setType] = useState<InterventionType>(InterventionType.PHONE_CALL);
  const [status, setStatus] = useState<string>('DONE');
  const [level, setLevel] = useState<ConfidentialityLevel>(ConfidentialityLevel.NORMAL);
  const [content, setContent] = useState('');
  const [outcome, setOutcome] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [pending, setPending] = useState(false);

  const submit = async () => {
    setPending(true);
    const result = await recordInterventionAction({
      alertId,
      type,
      content,
      outcome,
      status,
      nextFollowUpAt: status === 'FOLLOW_UP' ? followUp : '',
      confidentialityLevel: level,
    });
    setPending(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success('Đã ghi nhận can thiệp');
    setContent('');
    setOutcome('');
    setFollowUp('');
    onSaved();
  };

  return (
    <form
      className="flex flex-col gap-3 rounded-md border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <h3 className="font-semibold">Ghi can thiệp</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="iv-type">Hình thức</Label>
          <Select value={type} onValueChange={(v) => setType(v as InterventionType)}>
            <SelectTrigger id="iv-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(InterventionType).map((t) => (
                <SelectItem key={t} value={t}>
                  {INTERVENTION_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="iv-status">Tình trạng</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger id="iv-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTERVENTION_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {INTERVENTION_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="iv-content">Nội dung đã trao đổi</Label>
        <Textarea
          id="iv-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="VD: Gọi điện hỏi lý do vắng, sinh viên cam kết đi học đầy đủ."
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="iv-outcome">Kết quả (tùy chọn)</Label>
        <Input id="iv-outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)} />
      </div>
      {status === 'FOLLOW_UP' && (
        <div className="grid gap-1.5">
          <Label htmlFor="iv-follow">Ngày hẹn theo dõi</Label>
          <Input
            id="iv-follow"
            type="date"
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
          />
        </div>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="iv-level">Mức bảo mật</Label>
        <Select value={level} onValueChange={(v) => setLevel(v as ConfidentialityLevel)}>
          <SelectTrigger id="iv-level" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.values(ConfidentialityLevel).map((l) => (
              <SelectItem key={l} value={l}>
                {CONFIDENTIALITY_LABELS[l]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        type="submit"
        size="sm"
        className="self-start"
        disabled={pending || content.trim().length < 5}
      >
        {pending && <Loader2 className="animate-spin" />}
        Lưu can thiệp
      </Button>
    </form>
  );
}
