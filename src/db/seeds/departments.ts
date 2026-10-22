/** Danh mục khoa chính thức do người dùng cung cấp (docs/rules/09). KHÔNG tự thêm/bớt. */
export const DEPARTMENTS = [
  { departmentId: 'K.CNTT', departmentName: 'Khoa Công nghệ thông tin' },
  { departmentId: 'K.DDT', departmentName: 'Khoa Điện - Điện tử' },
  { departmentId: 'K.KTCK', departmentName: 'Khoa Kỹ thuật Cơ khí' },
  { departmentId: 'K.KTXD', departmentName: 'Khoa Kỹ thuật Xây dựng' },
  {
    departmentId: 'K.CNSH',
    departmentName: 'Khoa Công nghệ sinh học - Công nghệ hóa học - Công nghệ thực phẩm',
  },
  { departmentId: 'K.KTQL', departmentName: 'Khoa Kinh tế - Quản lý công nghiệp' },
  { departmentId: 'K.KHXH', departmentName: 'Khoa Khoa học Xã hội' },
] as const;

/**
 * Danh mục ngành do người dùng cung cấp (docs/rules/09, chốt 2026-10-22). Mã ngắn tự đặt theo tiền
 * tố mã lớp; ngành của khoa khác chưa có — KHÔNG tự thêm.
 */
export const MAJORS = [
  { majorId: 'CNTT', majorName: 'Công nghệ thông tin', departmentId: 'K.CNTT' },
  { majorId: 'KTPM', majorName: 'Kỹ thuật phần mềm', departmentId: 'K.CNTT' },
  { majorId: 'HTTT', majorName: 'Hệ thống thông tin', departmentId: 'K.CNTT' },
  { majorId: 'KHMT', majorName: 'Khoa học máy tính', departmentId: 'K.CNTT' },
  { majorId: 'KHDL', majorName: 'Khoa học dữ liệu', departmentId: 'K.CNTT' },
] as const;
