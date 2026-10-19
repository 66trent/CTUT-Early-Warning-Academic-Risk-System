import type { ImportDataType } from '@/db/enums';
import type { SetupPhase } from './setup-steps';

/**
 * Nội dung hướng dẫn trang "Bắt đầu" (docs/rules/07) — tách khỏi logic tính trạng thái
 * (`setup-steps.ts`). Không ghi ngưỡng luật cụ thể (số %, số bài): ngưỡng đọc ở Cấu hình luật,
 * ghi ở đây sẽ lệch khi Admin đổi luật.
 */

export interface StepGuide {
  /** Các việc cần làm, theo thứ tự. */
  what: string[];
  why: string;
  /** File mẫu cần chuẩn bị (bước nạp dữ liệu). */
  templates?: ImportDataType[];
  /** Lưu ý ngắn. */
  tip?: string;
}

export const PHASE_INTROS: Record<SetupPhase, string> = {
  FOUNDATION: 'Làm 1 lần khi bắt đầu dùng hệ thống, và lặp lại khi có khóa sinh viên mới.',
  TERM: 'Đầu mỗi học kỳ (1 năm học có 3 học kỳ chính).',
  DURING_TERM: 'Lặp lại mỗi tuần trong học kỳ — càng đều đặn, cảnh báo càng sớm.',
  END_OF_TERM: 'Khi các học phần khóa điểm, trước khi sang học kỳ mới.',
};

export const STEP_GUIDES: Record<string, StepGuide> = {
  departments: {
    what: ['Kiểm tra danh mục khoa ở cuối trang Khoa và lớp sinh hoạt.'],
    why: 'Mỗi lớp sinh hoạt thuộc 1 khoa; số liệu tổng quan và bộ lọc đều chia theo khoa.',
  },
  advisors: {
    what: [
      'Cố vấn học tập tự đăng ký ở trang đăng nhập bằng email cán bộ của trường.',
      'Mở Tài khoản, lọc "Chờ duyệt", kiểm tra mã cán bộ rồi bấm Duyệt.',
    ],
    why: 'Chỉ tài khoản đã duyệt mới được gán làm Cố vấn học tập của lớp và nhận cảnh báo.',
    tip: 'Không duyệt tài khoản lạ — Cố vấn học tập xem được thông tin học tập của sinh viên.',
  },
  classes: {
    what: [
      'Tạo lớp sinh hoạt: mã lớp, tên lớp, khoa, khóa (năm nhập học).',
      'Gán Cố vấn học tập phụ trách cho từng lớp.',
    ],
    why: 'Cố vấn học tập chỉ thấy sinh viên thuộc lớp mình được gán; lớp chưa có người phụ trách thì cảnh báo không có ai xử lý.',
  },
  students: {
    what: [
      'Tải file mẫu, điền danh sách sinh viên (mã lớp phải trùng lớp đã tạo).',
      'Nạp file → xem trước → sửa dòng lỗi nếu có → xác nhận nạp.',
    ],
    why: 'Mọi dữ liệu học tập sau này chỉ nhận sinh viên đã có trong danh sách; sinh viên cũng chỉ đăng nhập được khi đã có hồ sơ.',
    templates: ['STUDENT'],
    tip: 'Email sinh viên phải có đuôi @student.ctuet.edu.vn.',
  },
  term: {
    what: ['Tạo học kỳ (mã, tên, ngày bắt đầu, kết thúc).', 'Đặt làm học kỳ hiện tại.'],
    why: 'Dữ liệu nạp và cảnh báo đều gắn với 1 học kỳ. Không cần nhập lớp học phần hay đăng ký học phần — hệ thống tự tạo từ dữ liệu nạp.',
  },
  rules: {
    what: [
      'Xem 12 luật cảnh báo và ngưỡng đang áp dụng.',
      'Muốn đổi ngưỡng: tạo phiên bản mới → chạy thử so sánh → kích hoạt.',
    ],
    why: 'Ngưỡng quyết định lúc nào sinh viên được báo. Mỗi lần sửa tạo phiên bản mới, không ghi đè, nên luôn truy lại được cảnh báo cũ dùng ngưỡng nào.',
  },
  attendance: {
    what: [
      'Xuất số liệu điểm danh theo tiết của từng lớp học phần (tổng tiết, tiết vắng có phép, không phép).',
      'Nạp file, chọn học kỳ; kiểm tra thẻ nhận diện học phần ở màn xem trước rồi xác nhận.',
    ],
    why: 'Vắng học là dấu hiệu sớm nhất — phát hiện từ giữa học kỳ, trước khi có điểm.',
    templates: ['ATTENDANCE_SUMMARY'],
    tip: 'Mỗi lần nạp là 1 ngày chốt; hệ thống giữ mọi ngày chốt để so sánh xu hướng.',
  },
  lms: {
    what: [
      'Xuất kết quả bài trắc nghiệm và trạng thái nộp bài thực hành từ LMS, kèm hạn nộp từng bài.',
      'Nạp 2 loại file riêng, mỗi loại 1 lần.',
    ],
    why: 'Bỏ bài, điểm thấp, nộp trễ là dấu hiệu học tập sa sút trước kỳ thi.',
    templates: ['LMS_QUIZ', 'LMS_ASSIGNMENT'],
  },
  evaluation: {
    what: [
      'Hệ thống tự chạy sau mỗi lần nạp dữ liệu học tập và mỗi đêm.',
      'Muốn xem ngay: mở Chạy đánh giá, chọn học kỳ (hoặc 1 học phần) rồi bấm chạy.',
    ],
    why: 'Lần chạy áp dụng các luật lên dữ liệu đã nạp, tạo cảnh báo và gửi thông báo cho Cố vấn học tập.',
    tip: 'Chế độ demo không tự chạy — Admin bấm chạy và chọn mốc dữ liệu.',
  },
  'advisor-handling': {
    what: [
      'Theo dõi cảnh báo mới và cảnh báo của lớp chưa có Cố vấn học tập.',
      'Cố vấn học tập xác nhận, ghi can thiệp và đóng cảnh báo — Admin chỉ xem.',
    ],
    why: 'Cảnh báo chỉ có ích khi có người liên hệ sinh viên. Sinh viên chỉ thấy cảnh báo sau khi Cố vấn học tập xác nhận.',
  },
  'final-results': {
    what: ['Học phần nào khóa điểm thì xuất bảng điểm và nạp ngay, không cần đợi đủ mọi học phần.'],
    why: 'Dùng cho các luật học lực: không đạt học phần, tín chỉ không đạt, điểm trung bình — và nhận diện học lại ở học kỳ sau.',
    templates: ['COURSE_RESULT'],
  },
  'close-term': {
    what: [
      'Mở Học kỳ → Chốt học kỳ; xem danh sách sinh viên còn thiếu kết quả.',
      'Xác nhận: hệ thống chạy đánh giá lần cuối rồi chốt.',
    ],
    why: 'Sau khi chốt, học kỳ không nhận thêm dữ liệu — kết quả đánh giá cuối kỳ được giữ nguyên làm căn cứ.',
    tip: 'Đặt học kỳ mới làm học kỳ hiện tại sau khi chốt.',
  },
};

export interface FaqItem {
  question: string;
  answer: string;
}

export const GETTING_STARTED_FAQ: FaqItem[] = [
  {
    question: 'Cảnh báo có phải quyết định học vụ không?',
    answer:
      'Không. Cảnh báo chỉ là dấu hiệu tham khảo để Cố vấn học tập hỗ trợ sinh viên sớm. Tình trạng học vụ chính thức chỉ do phòng đào tạo cập nhật, hệ thống không bao giờ tự sửa.',
  },
  {
    question: 'Vì sao sinh viên chưa thấy cảnh báo của mình?',
    answer:
      'Sinh viên chỉ thấy cảnh báo sau khi Cố vấn học tập xác nhận, để Cố vấn học tập kiểm tra trước và liên hệ đúng cách. Sinh viên không nhận email cảnh báo.',
  },
  {
    question: '"Chưa đủ dữ liệu" nghĩa là gì?',
    answer:
      'Sinh viên chưa có dữ liệu ở nguồn nào (điểm danh, bài LMS, kết quả) để tính điểm rủi ro. Không có nghĩa là rủi ro thấp — cần nạp bổ sung dữ liệu.',
  },
  {
    question: 'Nạp nhầm file thì làm sao?',
    answer:
      'Ở màn xem trước bấm Hủy, dữ liệu chưa được ghi. Nếu đã xác nhận nạp, mở lô nhập đó và bấm Hoàn tác — chỉ được khi lô chỉ thêm dữ liệu mới (không sửa dòng có sẵn) và chưa có lô cùng loại nạp sau. Nếu không hoàn tác được, nạp lại file đúng để ghi đè.',
  },
  {
    question: 'Muốn đổi ngưỡng cảnh báo thì làm thế nào?',
    answer:
      'Vào Cấu hình luật, mở luật cần đổi, tạo phiên bản mới và chạy thử để xem số sinh viên bị ảnh hưởng, rồi mới kích hoạt. Phiên bản cũ vẫn được lưu.',
  },
  {
    question: 'Tạo lớp học phần, đăng ký học phần ở đâu?',
    answer:
      'Không cần tạo. Học phần và danh sách sinh viên học phần được hệ thống tự tạo từ file điểm danh, LMS và kết quả khi nạp.',
  },
  {
    question: 'Sinh viên đăng nhập bằng gì?',
    answer:
      'Bằng tài khoản Google email @student.ctuet.edu.vn, và chỉ khi đã có trong danh sách sinh viên. Cố vấn học tập và Admin đăng nhập bằng email và mật khẩu.',
  },
];
