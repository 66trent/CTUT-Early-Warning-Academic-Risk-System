/**
 * Thang điểm chữ 9 mức theo quy chế trường (docs/rules/10, người dùng xác nhận). Hàm thuần.
 * So sánh theo số nguyên (điểm × 10) để tránh sai số dấu phẩy động ở mốc nửa điểm.
 */
export const LETTER_GRADES = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F'] as const;
export type LetterGrade = (typeof LETTER_GRADES)[number];

/** Điểm tối thiểu (× 10) của từng mức, từ cao xuống thấp. */
const SCALE: readonly [LetterGrade, number][] = [
  ['A+', 95],
  ['A', 85],
  ['B+', 80],
  ['B', 70],
  ['C+', 65],
  ['C', 55],
  ['D+', 50],
  ['D', 40],
  ['F', 0],
];

/** Điểm tổng kết thang 10 → điểm chữ. */
export function letterFromScore(score: number): LetterGrade {
  const tenths = Math.round(score * 10);
  return SCALE.find(([, min]) => tenths >= min)?.[0] ?? 'F';
}

export function isLetterGrade(value: string): value is LetterGrade {
  return (LETTER_GRADES as readonly string[]).includes(value);
}

/** F = không đạt, phải học lại; các mức còn lại là đạt. */
export const isPassingLetter = (letter: LetterGrade) => letter !== 'F';
