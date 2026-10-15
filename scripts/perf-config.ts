/** Quy mô dữ liệu đo hiệu năng (docs/rules/05) — dùng chung cho perf:seed và perf:measure. */
export const PERF = {
  students: 5000,
  classSize: 50,
  departments: ['K.CNTT', 'K.KTCK', 'K.DDT', 'K.KTXD', 'K.KTQL'],
  courses: 40,
  coursesPerStudent: 5,
  currentTerm: 'PHK1_2026',
  previousTerm: 'PHK2_2025',
} as const;
