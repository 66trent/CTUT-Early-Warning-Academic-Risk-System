/**
 * Tên hệ thống — đọc từ NEXT_PUBLIC_APP_NAME (inline lúc build), dùng chung giao diện/email.
 * MUST NOT ghi cứng tên hệ thống ở nơi khác (docs/rules/00).
 */
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? '';

export const UNIVERSITY_NAME = 'Trường Đại học Kỹ thuật - Công nghệ Cần Thơ';
