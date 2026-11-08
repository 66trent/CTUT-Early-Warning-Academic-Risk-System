'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Severity } from '@/db/enums';
import { SEVERITY_LABELS } from '@/lib/labels';
import { cn } from '@/lib/utils';
import {
  type ConditionSchema,
  type ConditionValue,
  defaultValueFor,
  numberStep,
} from '@/modules/rule-engine/condition-schema';
import { CONDITION_ENUM_LABELS, conditionFieldLabel } from '@/modules/rule-engine/labels';

interface EditorProps {
  ruleCode: string;
  schema: ConditionSchema;
  value: ConditionValue;
  onChange?: (value: ConditionValue) => void;
  /** Chỉ xem (phiên bản đang áp dụng / bản nháp đã lưu). */
  readOnly?: boolean;
}

type Obj = { [key: string]: ConditionValue };
const asObject = (v: ConditionValue): Obj =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? v : {};
const asArray = (v: ConditionValue): ConditionValue[] => (Array.isArray(v) ? v : []);

function enumLabel(value: string): string {
  return SEVERITY_LABELS[value as Severity] ?? CONDITION_ENUM_LABELS[value] ?? value;
}

/** 1 ô nhập giá trị đơn (số, đúng/sai, liệt kê). */
function ScalarField({
  id,
  schema,
  value,
  onChange,
  readOnly,
  label,
}: {
  id: string;
  schema: ConditionSchema;
  value: ConditionValue;
  onChange: (v: ConditionValue) => void;
  readOnly: boolean;
  label: string;
}) {
  if (schema.enum) {
    return (
      <Select
        value={typeof value === 'string' ? value : ''}
        onValueChange={onChange}
        disabled={readOnly}
      >
        <SelectTrigger id={id} aria-label={label} className="w-full min-w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {schema.enum.map((v) => (
            <SelectItem key={v} value={v}>
              {enumLabel(v)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  if (schema.type === 'boolean') {
    return (
      <label className="flex min-h-9 items-center gap-2 text-sm">
        <input
          id={id}
          type="checkbox"
          className="size-4 accent-primary"
          checked={value === true}
          disabled={readOnly}
          onChange={(e) => onChange(e.target.checked)}
        />
        {value === true ? 'Có' : 'Không'}
      </label>
    );
  }
  return (
    <Input
      id={id}
      aria-label={label}
      type="number"
      inputMode="decimal"
      className="w-full min-w-24 tabular-nums"
      value={typeof value === 'number' ? value : ''}
      step={numberStep(schema)}
      min={schema.minimum ?? schema.exclusiveMinimum}
      max={schema.maximum}
      readOnly={readOnly}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
    />
  );
}

/** Mảng các object (VD các dải ngưỡng) — bảng nhỏ, thêm/bớt dòng. */
function ArrayField({ ruleCode, schema, value, onChange, readOnly, path }: FieldProps) {
  const itemSchema = schema.items ?? {};
  const rows = asArray(value);
  const columns = Object.entries(itemSchema.properties ?? {});
  const min = schema.minItems ?? 0;
  return (
    // min-w-0: ô lưới không giãn theo bảng — bảng cuộn ngang trong khung trên điện thoại.
    <div className="flex min-w-0 flex-col gap-2">
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              {columns.map(([key]) => (
                <th key={key} className="px-3 py-2 font-medium">
                  {conditionFieldLabel(ruleCode, key)}
                </th>
              ))}
              {!readOnly && <th className="w-12" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t">
                {columns.map(([key, s]) => (
                  <td key={key} className="px-3 py-2">
                    <ScalarField
                      id={`${path}-${i}-${key}`}
                      label={`${conditionFieldLabel(ruleCode, key)} (dòng ${i + 1})`}
                      schema={s}
                      value={asObject(row)[key] ?? null}
                      readOnly={readOnly}
                      onChange={(v) =>
                        onChange(rows.map((r, j) => (j === i ? { ...asObject(r), [key]: v } : r)))
                      }
                    />
                  </td>
                ))}
                {!readOnly && (
                  <td className="px-2">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Xóa dòng ${i + 1}`}
                      disabled={rows.length <= min}
                      onClick={() => onChange(rows.filter((_, j) => j !== i))}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="self-start"
          onClick={() => onChange([...rows, defaultValueFor(itemSchema)])}
        >
          <Plus aria-hidden />
          Thêm mức
        </Button>
      )}
    </div>
  );
}

/** Bảng khóa → giá trị (VD quy đổi điểm chữ): chỉ sửa giá trị. */
function RecordField({ schema, value, onChange, readOnly, path }: FieldProps) {
  const valueSchema =
    typeof schema.additionalProperties === 'object' ? schema.additionalProperties : {};
  // jsonb không giữ thứ tự khóa → sắp theo giá trị giảm dần (A+, A, B+, …), cùng giá trị thì khóa dài trước.
  const entries = Object.entries(asObject(value)).sort(
    ([ka, a], [kb, b]) =>
      (typeof b === 'number' ? b : 0) - (typeof a === 'number' ? a : 0) || kb.localeCompare(ka),
  );
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
      {entries.map(([key, v]) => (
        <label key={key} className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{key}</span>
          <ScalarField
            id={`${path}-${key}`}
            label={key}
            schema={valueSchema}
            value={v}
            readOnly={readOnly}
            onChange={(next) => onChange({ ...asObject(value), [key]: next })}
          />
        </label>
      ))}
    </div>
  );
}

interface FieldProps {
  ruleCode: string;
  schema: ConditionSchema;
  value: ConditionValue;
  onChange: (v: ConditionValue) => void;
  readOnly: boolean;
  path: string;
}

function Field(props: FieldProps & { name: string }) {
  const { ruleCode, schema, name, path } = props;
  const label = conditionFieldLabel(ruleCode, name);
  if (schema.type === 'object' && schema.properties) {
    return (
      <fieldset className="flex flex-col gap-3 rounded-md border p-3">
        <legend className="px-1 text-sm font-semibold">{label}</legend>
        <ObjectFields {...props} />
      </fieldset>
    );
  }
  const complex = schema.type === 'array' || schema.type === 'object';
  return (
    <div
      className={cn('grid gap-2', !complex && 'sm:grid-cols-[minmax(0,1fr)_14rem] sm:items-center')}
    >
      <label htmlFor={path} className="text-sm font-medium">
        {label}
      </label>
      {schema.type === 'array' ? (
        <ArrayField {...props} />
      ) : schema.type === 'object' ? (
        <RecordField {...props} />
      ) : (
        <ScalarField id={path} label={label} {...props} />
      )}
    </div>
  );
}

function ObjectFields({ ruleCode, schema, value, onChange, readOnly, path }: FieldProps) {
  const obj = asObject(value);
  return (
    <>
      {Object.entries(schema.properties ?? {}).map(([key, s]) => (
        <Field
          key={key}
          name={key}
          ruleCode={ruleCode}
          schema={s}
          value={obj[key] ?? null}
          readOnly={readOnly}
          path={`${path}-${key}`}
          onChange={(v) => onChange({ ...obj, [key]: v })}
        />
      ))}
    </>
  );
}

/**
 * Form cấu hình ngưỡng tự sinh từ cấu trúc `condition` của luật — không ghi cứng từng luật
 * (thêm luật mới không phải sửa giao diện). Server kiểm tra lại bằng Zod khi lưu.
 */
export function ConditionEditor({
  ruleCode,
  schema,
  value,
  onChange,
  readOnly = false,
}: EditorProps) {
  return (
    <div className="flex flex-col gap-4">
      <ObjectFields
        ruleCode={ruleCode}
        schema={schema}
        value={value}
        readOnly={readOnly}
        path={`cond-${ruleCode}`}
        onChange={(v) => onChange?.(v)}
      />
    </div>
  );
}
