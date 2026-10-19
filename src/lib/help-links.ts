/**
 * Nút "?" ở đầu trang mở đúng bước tương ứng trên trang Bắt đầu (neo `#buoc-<key>` theo
 * `SetupStep.key`). Phase 8c viết lại nội dung hướng dẫn, giữ nguyên các neo này.
 */
const step = (key: string) => `/admin/getting-started#buoc-${key}`;

export const HELP_LINKS = {
  users: step('advisors'),
  terms: step('term'),
  rules: step('rules'),
  classes: step('classes'),
  students: step('students'),
  imports: step('attendance'),
  evaluations: step('evaluation'),
  alerts: step('advisor-handling'),
  closeTerm: step('close-term'),
} as const;

export const stepAnchor = (key: string) => `buoc-${key}`;
