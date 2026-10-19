/**
 * Hướng dẫn ngắn "Lần đầu dùng?" cho Cố vấn học tập và sinh viên (docs/rules/07) — dùng được ở
 * client (không import DB). Không ghi ngưỡng luật cụ thể (lệch khi Admin đổi luật).
 */
export interface QuickGuide {
  title: string;
  steps: { title: string; text: string }[];
}

export const ADVISOR_GUIDE: QuickGuide = {
  title: 'Lần đầu dùng? 4 bước xử lý cảnh báo',
  steps: [
    {
      title: 'Xem việc cần làm',
      text: 'Trang Tổng quan cho biết cảnh báo mới chờ bạn xác nhận, cảnh báo quá hạn và lịch hẹn theo dõi đến hạn.',
    },
    {
      title: 'Mở cảnh báo, đọc lý do',
      text: 'Mỗi cảnh báo ghi rõ dấu hiệu theo nguồn (điểm danh, bài LMS, kết quả) kèm số liệu và ngày dữ liệu.',
    },
    {
      title: 'Xác nhận rồi liên hệ sinh viên',
      text: 'Sinh viên chỉ thấy cảnh báo SAU KHI bạn xác nhận. Gọi điện, gặp trực tiếp hoặc gửi email rồi ghi lại can thiệp.',
    },
    {
      title: 'Theo dõi và đóng',
      text: 'Chọn "Cần theo dõi tiếp" kèm ngày hẹn nếu cần; khi đã ổn, đóng cảnh báo là "Đã giải quyết". Cảnh báo chỉ mang tính tham khảo.',
    },
  ],
};

export const STUDENT_GUIDE: QuickGuide = {
  title: 'Trang này giúp gì cho bạn?',
  steps: [
    {
      title: 'Theo dõi việc học của chính bạn',
      text: 'Mỗi học phần có số tiết vắng so với ngưỡng không được dự thi, số bài trắc nghiệm và thực hành đã nộp, kết quả khi khóa điểm.',
    },
    {
      title: 'Điều nên chú ý',
      text: 'Khi Cố vấn học tập đã trao đổi với bạn về một điểm cần cải thiện, khối "Tổng quan" sẽ hiện gợi ý cụ thể.',
    },
    {
      title: 'Cần hỗ trợ',
      text: 'Liên hệ Cố vấn học tập bằng nút ở cuối trang. Thông tin ở đây chỉ để tham khảo, không phải quyết định học vụ.',
    },
  ],
};
