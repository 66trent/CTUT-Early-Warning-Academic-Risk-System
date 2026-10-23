"""Sinh bộ dữ liệu demo v2 (Phase 8a) vào docs/demo-data. Chạy ở thư mục gốc dự án: python -I docs/demo-data/gen_demo_v2.py ."""
import csv, io, sys, os

ROOT = sys.argv[1]
OUT = os.path.join(ROOT, 'docs', 'demo-data')

def write(name, header, rows):
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator='\n')
    w.writerow(header)
    for r in rows:
        w.writerow(['' if v is None else v for v in r])
    with open(os.path.join(OUT, name), 'w', encoding='utf-8-sig', newline='') as f:
        f.write(buf.getvalue())

STUDENTS = [
    ('901', 'Nguyễn Minh', 'An'), ('902', 'Trần Thị', 'Bích'), ('903', 'Lê Văn', 'Cường'),
    ('904', 'Phạm Thị', 'Dung'), ('905', 'Hoàng Văn', 'Em'), ('906', 'Võ Thị', 'Giang'),
    ('907', 'Đặng Văn', 'Hải'), ('908', 'Bùi Thị', 'Hoa'), ('909', 'Đỗ Văn', 'Khánh'),
    ('910', 'Ngô Thị', 'Lan'), ('911', 'Dương Văn', 'Long'), ('912', 'Lý Thị', 'Mai'),
    ('913', 'Huỳnh Văn', 'Nam'), ('914', 'Phan Thị', 'Oanh'), ('915', 'Vũ Văn', 'Phúc'),
    ('916', 'Trương Thị', 'Quỳnh'), ('917', 'Mai Văn', 'Sơn'), ('918', 'Hồ Thị', 'Thảo'),
    ('919', 'Tạ Văn', 'Uy'), ('920', 'Đặng Minh', 'Tú'),
]
MSSV = lambda n: f'KTPM2411{n}'
SLUG = {'An': 'an', 'Bích': 'bich', 'Cường': 'cuong', 'Dung': 'dung', 'Em': 'em', 'Giang': 'giang',
        'Hải': 'hai', 'Hoa': 'hoa', 'Khánh': 'khanh', 'Lan': 'lan', 'Long': 'long', 'Mai': 'mai',
        'Nam': 'nam', 'Oanh': 'oanh', 'Phúc': 'phuc', 'Quỳnh': 'quynh', 'Sơn': 'son', 'Thảo': 'thao',
        'Uy': 'uy', 'Tú': 'tu'}

# 3 học phần (mã lớp học phần → mã học phần tự suy = bỏ 2 số cuối). Tên/tín chỉ/số tiết của
# Ngôn ngữ lập trình 1 và Cơ sở dữ liệu là giá trị DEMO.
LOG = ('010100240802', 'Logic học', 30, 2)
NNLT = ('010100239401', 'Ngôn ngữ lập trình 1', 45, 3)
CSDL = ('010100241001', 'Cơ sở dữ liệu', 45, 3)

# 01 — sinh viên
write('01_sinh_vien.csv', ['mssv', 'ho_ten', 'email', 'ma_lop_sinh_hoat', 'trang_thai_hoc_vu'], [
    [MSSV(n), f'{ho} {ten}', f'{SLUG[ten]}.ktpm2411{n}@student.ctuet.edu.vn', 'KTPM2411', 'ACTIVE']
    for n, ho, ten in STUDENTS])

# 02 — điểm danh (tiết): (ngày, CP, KP) cho từng (sv, học phần); mặc định 0/0.
ABS = {
    ('902', LOG): [(1, 1), (1, 2)],
    ('903', NNLT): [(2, 2), (2, 8)],
    ('904', NNLT): [(0, 5), (0, 9)],
    ('907', LOG): [(0, 1), (0, 1)],
    ('910', CSDL): [(2, 3), (2, 3)],
    ('911', CSDL): [(0, 3), (0, 5)],
    ('913', LOG): [(0, 4), (0, 8)],
    ('920', CSDL): [(4, 0), (4, 0)],
}
rows = []
for date_i, date in enumerate(['2025-10-02', '2025-10-09']):
    for course in (LOG, NNLT, CSDL):
        for n, ho, ten in STUDENTS:
            cp, kp = ABS.get((n, course), [(0, 0), (0, 0)])[date_i]
            ten_file = 'Tuấn' if (n == '920' and course == CSDL and date_i == 1) else ten
            rate = f'{(cp + kp) * 100 / course[2]:.2f}'
            rows.append([MSSV(n), ho, ten_file, course[0], None, course[1], date, course[2], cp, kp, rate])
write('02_HK1_2025_diem_danh.csv', ['mssv', 'ho_dem', 'ten', 'ma_lop_hoc_phan', 'ma_hoc_phan', 'ten_hoc_phan',
                                     'ngay_chot', 'tong_so_tiet', 'vang_co_phep', 'vang_khong_phep', 'ty_le_vang'], rows)

# 03 — bài trắc nghiệm: Logic học Q1/Q2, NNLT Q1/Q2 (có hạn nộp). Mỗi bài 10 câu, điểm /10.
QUIZZES = [
    (LOG, 'TN01', 'Trắc nghiệm chương 1', '2025-09-20'),
    (LOG, 'TN02', 'Trắc nghiệm chương 2', '2025-10-04'),
    (NNLT, 'TN01', 'Trắc nghiệm biến và kiểu dữ liệu', '2025-09-27'),
    (NNLT, 'TN02', 'Trắc nghiệm cấu trúc điều khiển', '2025-10-08'),
]
DEFAULT_SCORE = {'901': 9, '920': 9}
SPECIAL_QUIZ = {  # (sv, học phần, mã bài) → list lượt (điểm) hoặc 'NONE' = chưa làm
    ('905', LOG, 'TN01'): 'NONE', ('905', LOG, 'TN02'): 'NONE',
    ('906', LOG, 'TN01'): [3, 4], ('906', LOG, 'TN02'): [4.5],
    ('907', LOG, 'TN01'): [5], ('907', LOG, 'TN02'): [3],
}
rows = []
for course, key, name, due in QUIZZES:
    y, m, d = map(int, due.split('-'))
    for n, ho, ten in STUDENTS:
        spec = SPECIAL_QUIZ.get((n, course, key), [DEFAULT_SCORE.get(n, 8)])
        base = [MSSV(n), ho, ten, course[0], None, key, name, due]
        if spec == 'NONE':
            rows.append(base + [None, None, None, None, None, 10, None, 10, 'Chưa làm'])
            continue
        for i, score in enumerate(spec):
            day = d - 2 + i
            start = f'{y:04d}-{m:02d}-{day:02d} 20:{int(n) % 30 + 10:02d}'
            end = f'{y:04d}-{m:02d}-{day:02d} 20:{int(n) % 30 + 30:02d}'
            correct = int(score)
            rows.append(base + [i + 1, start, end, 20, score, 10, correct, 10, 'Đã nộp'])
write('03_HK1_2025_lms_trac_nghiem.csv', ['mssv', 'ho_dem', 'ten', 'ma_lop_hoc_phan', 'ma_hoc_phan', 'ma_bai', 'ten_bai',
                                           'han_nop', 'lan_lam', 'thoi_diem_bat_dau', 'thoi_diem_nop',
                                           'thoi_gian_lam_phut', 'diem', 'diem_toi_da', 'so_cau_dung',
                                           'tong_so_cau', 'trang_thai'], rows)

# 04 — bài thực hành: NNLT TH01–TH03, CSDL TH01–TH02. Mặc định nộp đúng hạn 2 ngày trước hạn.
ASSIGNMENTS = [
    (NNLT, 'TH01', 'Thực hành 1: Nhập xuất', '2025-09-25'),
    (NNLT, 'TH02', 'Thực hành 2: Rẽ nhánh', '2025-10-05'),
    (NNLT, 'TH03', 'Thực hành 3: Vòng lặp', '2025-10-14'),
    (CSDL, 'TH01', 'Thực hành 1: Thiết kế ERD', '2025-09-30'),
    (CSDL, 'TH02', 'Thực hành 2: Câu lệnh SQL', '2025-10-07'),
]
SPECIAL_SUB = {  # → ('Chưa nộp', None) | ('Nộp trễ', 'YYYY-MM-DD HH:mm') | ('Đã nộp', time)
    ('908', NNLT, 'TH01'): ('Chưa nộp', None), ('908', NNLT, 'TH02'): ('Chưa nộp', None),
    ('909', NNLT, 'TH01'): ('Nộp trễ', '2025-09-27 21:00'), ('909', NNLT, 'TH02'): ('Nộp trễ', '2025-10-07 21:00'),
    ('910', CSDL, 'TH01'): ('Chưa nộp', None),
    ('911', CSDL, 'TH01'): ('Nộp trễ', '2025-10-02 21:00'), ('911', CSDL, 'TH02'): ('Nộp trễ', '2025-10-09 21:00'),
    ('912', NNLT, 'TH03'): ('Chưa nộp', None),
}
rows = []
for course, key, name, due in ASSIGNMENTS:
    y, m, d = map(int, due.split('-'))
    early = '2025-10-08 19:30' if key == 'TH03' and course == NNLT else f'{y:04d}-{m:02d}-{d - 2:02d} 19:30'
    for n, ho, ten in STUDENTS:
        status, when = SPECIAL_SUB.get((n, course, key), ('Đã nộp', early))
        rows.append([MSSV(n), ho, ten, course[0], None, key, name, due, status, when])
write('04_HK1_2025_lms_thuc_hanh.csv', ['mssv', 'ho_dem', 'ten', 'ma_lop_hoc_phan', 'ma_hoc_phan', 'ma_bai', 'ten_bai',
                                         'han_nop', 'trang_thai_nop', 'thoi_diem_nop'], rows)

# 05/06 — kết quả học phần đã khóa điểm. Điểm chữ chọn trước, điểm thường xuyên/cuối kỳ khớp tỷ lệ 40/60.
GRADES = {  # sv: (LOG, NNLT, CSDL) — None = chưa có kết quả
    '901': ('A', 'A', 'B+'), '902': ('B', 'B', 'B'), '903': ('B', 'F', 'B'), '904': ('B', 'C', 'B'),
    '905': ('D', 'B', 'B'), '906': ('C', 'B', 'B+'), '907': ('B', 'B', 'B'), '908': ('B', 'D', 'C'),
    '909': ('B', 'B', 'B'), '910': ('B', 'C', 'C'), '911': ('B', 'B', 'C+'), '912': ('B', 'B', 'B'),
    '913': ('F', 'B+', 'B'), '914': ('F', 'B', 'B'), '915': ('D', 'F', 'F'), '916': ('C', 'C', 'C'),
    '917': ('D', 'D+', 'C'), '918': ('C', 'A', 'F'), '919': ('F', 'B', None), '920': ('B+', 'B+', 'A'),
}
SCORES = {  # điểm chữ → (thường xuyên, cuối kỳ) cho tổng kết 40/60 rơi đúng dải
    'A+': (9.5, 9.7), 'A': (8.5, 9.0), 'B+': (8.0, 8.3), 'B': (7.0, 7.5), 'C+': (6.5, 6.8), 'C': (6.0, 5.8),
    'D+': (5.0, 5.2), 'D': (4.5, 4.2), 'F': (3.0, 2.5),
}
POINT4 = {'A+': '4.0', 'A': '3.8', 'B+': '3.5', 'B': '3.0', 'C+': '2.5', 'C': '2.0', 'D+': '1.5', 'D': '1.0', 'F': '0.0'}
EXAM_FLAGS = {('913', LOG): ('Không', 'Không'), ('914', LOG): ('Có', 'Có'), ('903', NNLT): ('Không', 'Không')}

def result_rows(courses, published):
    out = []
    for course in courses:
        idx = {LOG: 0, NNLT: 1, CSDL: 2}[course]
        for n, ho, ten in STUDENTS:
            grade = GRADES[n][idx]
            if grade is None:
                continue
            tx, ck = SCORES[grade]
            eligible, absent = EXAM_FLAGS.get((n, course), ('Có', 'Không'))
            if eligible == 'Không':
                ck = None  # không được dự thi → không có điểm cuối kỳ
            if absent == 'Có':
                ck = 0
            out.append([MSSV(n), ho, ten, course[0], None, course[1], course[3], tx, eligible, ck, absent,
                        POINT4[grade], grade, published])
    return out

HEADER = ['mssv', 'ho_dem', 'ten', 'ma_lop_hoc_phan', 'ma_hoc_phan', 'ten_hoc_phan', 'so_tin_chi',
          'diem_thuong_xuyen', 'duoc_du_thi', 'diem_cuoi_ky', 'vang_thi', 'thang_diem_4', 'diem_chu', 'ngay_cong_bo']
write('05_HK1_2025_ket_qua_logic_hoc.csv', HEADER, result_rows([LOG], '2025-11-16'))
write('06_HK1_2025_ket_qua_cuoi_ky.csv', HEADER, result_rows([NNLT, CSDL], '2025-12-28'))
print('ok')
