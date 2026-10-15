/**
 * Mô tả cấu trúc `RuleVersion.condition` để giao diện tự sinh form (JSON Schema rút gọn, sinh từ
 * Zod bằng `z.toJSONSchema`). File chỉ chứa kiểu + hàm thuần — dùng được ở cả server và client.
 * Server vẫn kiểm tra lại bằng Zod của luật khi lưu (docs/rules/01).
 */
export interface ConditionSchema {
  type?: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean';
  properties?: Record<string, ConditionSchema>;
  /** Bản ghi khóa tự do (VD bảng quy đổi điểm chữ) — chỉ sửa giá trị, không thêm/bớt khóa. */
  additionalProperties?: ConditionSchema | boolean;
  items?: ConditionSchema;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  multipleOf?: number;
  minItems?: number;
}

export type ConditionValue =
  string | number | boolean | null | ConditionValue[] | { [key: string]: ConditionValue };

/** Bước nhập cho ô số: số nguyên = 1, có `multipleOf` thì theo đó, còn lại = 0,01. */
export function numberStep(schema: ConditionSchema): number {
  if (schema.type === 'integer') return schema.multipleOf ?? 1;
  return schema.multipleOf ?? 0.01;
}

/** Giá trị mặc định cho 1 dòng mới của mảng (VD thêm 1 dải ngưỡng). */
export function defaultValueFor(schema: ConditionSchema): ConditionValue {
  if (schema.enum && schema.enum.length > 0) return schema.enum[0] ?? '';
  switch (schema.type) {
    case 'object':
      return Object.fromEntries(
        Object.entries(schema.properties ?? {}).map(([k, s]) => [k, defaultValueFor(s)]),
      );
    case 'array':
      return [];
    case 'boolean':
      return false;
    case 'integer':
    case 'number':
      return Math.max(
        schema.minimum ?? 0,
        schema.exclusiveMinimum ?? 0,
        schema.type === 'integer' ? 1 : 0,
      );
    default:
      return '';
  }
}

/** Chuỗi gọn để so sánh/hiển thị thay đổi giữa 2 phiên bản. */
export function flattenCondition(
  value: ConditionValue,
  prefix = '',
): { path: string; value: string }[] {
  if (Array.isArray(value)) {
    return value.flatMap((v, i) => flattenCondition(v, `${prefix}[${i + 1}]`));
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) =>
      flattenCondition(v, prefix ? `${prefix}.${k}` : k),
    );
  }
  return [{ path: prefix, value: String(value) }];
}
