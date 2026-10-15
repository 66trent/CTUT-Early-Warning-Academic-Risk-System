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
