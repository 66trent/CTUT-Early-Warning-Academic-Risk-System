"""Sinh bộ dữ liệu demo v4 (Phase 11 đợt 4) vào docs/demo-data. Chạy ở thư mục gốc dự án:
    python -I docs/demo-data/gen_demo_v4.py .
Mọi số liệu tình huống là hằng ở đây và khớp KET_QUA_MONG_DOI.md, sửa file kết quả mong đợi TRƯỚC.
Sinh viên không có trong bảng tình huống nhận dữ liệu "sạch" (số liệu khác nhau, dưới mọi ngưỡng).
"""
import csv, io, os, shutil, sys, unicodedata

ROOT = sys.argv[1]
OUT = os.path.join(ROOT, 'docs', 'demo-data')

DIRS = ['02_HK2_2024_ket_qua', '03_HK3_2024_ket_qua', '04_HK1_2025_diem_danh_dot_1',
        '05_HK1_2025_diem_danh_dot_2', '06_HK1_2025_trac_nghiem', '07_HK1_2025_thuc_hanh',
        '08_HK1_2025_ket_qua_logic_hoc', '09_HK1_2025_ket_qua_cuoi_ky', 'minh-hoa-loi']


def write(rel, header, rows):
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator='\n')
    w.writerow(header)
    for r in rows:
        w.writerow(['' if v is None else v for v in r])
    path = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8-sig', newline='') as f:
        f.write(buf.getvalue())


# ---------------------------------------------------------------- Lớp, sinh viên
# Lớp → số thứ tự lớp học phần (mã lớp học phần = mã học phần + 2 số).
CLASSES = {'CNTT2411': '01', 'KTPM2411': '02', 'HTTT2411': '03', 'KHMT2411': '04', 'KHDL2411': '05',
           'KTPM2511': '11'}
COHORT_2024 = ['CNTT2411', 'KTPM2411', 'HTTT2411', 'KHMT2411', 'KHDL2411']
SIZE = {c: 20 for c in CLASSES}
SIZE['KTPM2511'] = 10
ALL = {c: [str(901 + i) for i in range(SIZE[c])] for c in CLASSES}

SURNAMES = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô',
            'Dương', 'Lý', 'Trương', 'Tạ', 'Đinh', 'Lâm', 'Cao', 'Tô', 'Châu']
MIDDLE = [['Văn', 'Minh', 'Quốc', 'Hữu', 'Đức', 'Anh', 'Gia'], ['Thị', 'Ngọc', 'Thanh', 'Mỹ', 'Kim', 'Thùy', 'Bảo']]
GIVEN = [['An', 'Bảo', 'Cường', 'Duy', 'Đạt', 'Giáp', 'Hải', 'Hiếu', 'Hoàng', 'Huy', 'Hưng', 'Khánh', 'Khoa', 'Kiên',
          'Long', 'Nam', 'Nghĩa', 'Phát', 'Phúc', 'Quân', 'Sơn', 'Tài', 'Thắng', 'Thành', 'Tiến', 'Trí', 'Tùng', 'Uy',
          'Vinh', 'Dũng'],
         ['Bích', 'Chi', 'Diễm', 'Dung', 'Giang', 'Hà', 'Hạnh', 'Hoa', 'Hương', 'Huyền', 'Lan', 'Linh', 'Loan', 'Mai',
          'Ngân', 'Nhi', 'Nhung', 'Oanh', 'Phương', 'Quỳnh', 'Thảo', 'Thư', 'Trang', 'Trâm', 'Tuyết', 'Vân', 'Vy',
          'Xuân', 'Yến', 'Châu']]


def make_names():
    """Mỗi sinh viên một họ tên (giả), xen kẽ nam nữ; dừng ngay nếu trùng."""
    out, seen, i = {}, set(), 0
    for cls in CLASSES:
        for n in ALL[cls]:
            g = i % 2
            k = i // 2
            ho = f'{SURNAMES[(k * 3 + g * 5) % len(SURNAMES)]} {MIDDLE[g][(k + i) % 7]}'
            ten = GIVEN[g][(k * 7) % 30]
            assert f'{ho} {ten}' not in seen, f'trùng {ho} {ten}'
            seen.add(f'{ho} {ten}')
            out[(cls, n)] = (ho, ten)
            i += 1
    return out


NAME_OF = make_names()


def slug(text):
    s = unicodedata.normalize('NFD', text.replace('Đ', 'D').replace('đ', 'd'))
    return ''.join(ch for ch in s if unicodedata.category(ch) != 'Mn').lower()


MSSV = lambda cls, n: f'{cls}{n}'

# Tình trạng học vụ khác ACTIVE: không có dữ liệu học kỳ này.
STATUS = {('KHDL2411', '915'): 'DISMISSED', ('KHDL2411', '916'): 'RESERVED', ('KHDL2411', '917'): 'SUSPENDED'}
TRANSFERRED = {('KHDL2411', '918'), ('KHDL2411', '919'), ('KHDL2411', '920')}  # không có học kỳ trước

# ---------------------------------------------------------------- Học phần
# (chuong-trinh-khung-ktpm.md): mã, tên, tín chỉ, tổng tiết.
LOG = ('0101002408', 'Logic học', 2, 30)
HQT = ('0101000900', 'Hệ quản trị cơ sở dữ liệu', 3, 60)
PTTK = ('0101000902', 'Phân tích và thiết kế hệ thống thông tin', 3, 60)
KTMT = ('0101000890', 'Kiến trúc máy tính', 3, 60)
MANG = ('0101000892', 'Mạng máy tính', 3, 60)
CSDL = ('0101000894', 'Cơ sở dữ liệu', 3, 60)
GT = ('0101002318', 'Giải thuật', 2, 30)
TTNT = ('0101000896', 'Trí tuệ nhân tạo', 3, 60)
XSTK = ('0101000773', 'Xác suất và thống kê', 2, 30)
TTHCM = ('0101002336', 'Tư tưởng Hồ Chí Minh', 2, 30)
PTCSDL = ('0101002299', 'Phân tích cơ sở dữ liệu lớn', 3, 60)
TOAN = ('0101000889', 'Toán rời rạc', 3, 45)
NNLT1 = ('0101002394', 'Ngôn ngữ lập trình 1', 2, 45)

HK3_COURSES = [('0101000889', 'Toán rời rạc', 3), ('0101000894', 'Cơ sở dữ liệu', 3),
               ('0101000895', 'Lập trình hướng đối tượng', 3), ('0101002295', 'Cấu trúc dữ liệu', 2),
               ('0101002335', 'Chủ nghĩa xã hội khoa học', 2), ('0101000714', 'Anh văn căn bản 3', 3)]

COURSES = {
    'CNTT2411': [LOG, KTMT, MANG],
    'KTPM2411': [LOG, HQT, PTTK],
    'HTTT2411': [LOG, HQT, PTTK, CSDL],
    'KHMT2411': [LOG, GT, TTNT],
    'KHDL2411': [XSTK, TTHCM, PTCSDL],
    'KTPM2511': [TOAN, NNLT1],
}

CSDL_RETAKE_SECTION = '010100089401'
RETAKERS = ['903', '904', '905', '911', '912']

TN2_A = [('TN01', 'Trắc nghiệm chương 1', '2025-09-20'), ('TN02', 'Trắc nghiệm chương 2', '2025-10-04')]
TN2_B = [('TN01', 'Trắc nghiệm chương 1', '2025-09-27'), ('TN02', 'Trắc nghiệm chương 2', '2025-10-08')]
QUIZ_DUE = {LOG: TN2_A, HQT: TN2_B, KTMT: TN2_B, TTNT: TN2_B, TTHCM: TN2_A,
            GT: TN2_B + [('TN03', 'Trắc nghiệm chương 3', None)]}
NO_DUE_ATTEMPT_DAY = (2025, 11, 12)  # lớp làm TN03 ngày 10/11
TH3 = [('TH01', 'Thực hành 1', '2025-09-25'), ('TH02', 'Thực hành 2', '2025-10-05'), ('TH03', 'Thực hành 3', '2025-10-14')]
TH2 = [('TH01', 'Thực hành 1', '2025-09-30'), ('TH02', 'Thực hành 2', '2025-10-07')]
ASSIGN_DUE = {HQT: TH3, MANG: TH3, TTNT: TH3, PTTK: TH2, KTMT: TH2, CSDL: TH2, PTCSDL: TH2}

DATES = ['2025-09-12', '2025-09-26', '2025-10-09', '2025-11-13']
NO_D4 = {LOG, CSDL, PTCSDL}  # Logic kết thúc sớm; CSDL, PTCSDL tạo tình huống điểm danh quá hạn


def dates_of(course):
    return DATES[:3] if course in NO_D4 else DATES


def section(cls, course):
    if cls == 'HTTT2411' and course == CSDL:
        return CSDL_RETAKE_SECTION
    return course[0] + CLASSES[cls]


def roster(cls, course):
    """Sinh viên học học phần ở học kỳ demo."""
    if cls == 'HTTT2411' and course == CSDL:
        return RETAKERS
    out = [n for n in ALL[cls] if (cls, n) not in STATUS]
    if cls == 'KHDL2411' and course != XSTK:
        out = [n for n in out if n != '919']  # 919 chuyển đến, chỉ học XSTK
    return out


def explicit_code(cls, course):
    """Mã học phần ghi rõ: chỉ học phần học lại."""
    return course[0] if (cls == 'HTTT2411' and course == CSDL) else None


# ---------------------------------------------------------------- Tình huống (KET_QUA_MONG_DOI.md)
# Điểm danh: (lớp, sv, học phần) → [(có phép, không phép) từng ngày chốt]
ABS = {
    ('KTPM2411', '902', LOG): [(0, 1), (1, 1), (1, 2)],
    ('KTPM2411', '903', HQT): [(1, 1), (2, 3), (2, 11), (2, 12)],
    ('KTPM2411', '904', HQT): [(0, 3), (0, 7), (0, 12), (0, 12)],
    ('KTPM2411', '907', LOG): [(0, 0), (0, 1), (0, 1)],
    ('KTPM2411', '910', PTTK): [(1, 2), (2, 4), (2, 5), (2, 5)],
    ('KTPM2411', '911', PTTK): [(0, 2), (0, 4), (0, 7), (0, 9)],
    ('KTPM2411', '913', LOG): [(0, 2), (0, 4), (0, 8)],
    ('KTPM2411', '920', PTTK): [(2, 0), (4, 0), (6, 0), (6, 0)],
    ('HTTT2411', '903', CSDL): [(0, 1), (0, 3), (0, 7)],
    ('HTTT2411', '911', CSDL): [(0, 2), (0, 5), (0, 9)],
    ('HTTT2411', '912', CSDL): [(0, 3), (0, 8), (0, 13)],
    ('KHMT2411', '903', TTNT): [(0, 1), (0, 3), (0, 7), (0, 7)],
    ('KHMT2411', '904', GT): [(0, 1), (0, 2), (0, 5), (0, 5)],
    ('KHMT2411', '908', TTNT): [(0, 2), (0, 4), (0, 6), (0, 6)],
    ('KHDL2411', '903', PTCSDL): [(1, 2), (2, 6), (4, 10)],
    ('KHDL2411', '906', XSTK): [(0, 1), (0, 3), (0, 1), (0, 1)],
    ('KTPM2511', '905', NNLT1): [(0, 1), (0, 3), (0, 5), (0, 5)],
    ('KTPM2511', '906', TOAN): [(0, 2), (0, 3), (0, 8), (0, 10)],
}
NO_ATTENDANCE = {('KHDL2411', '919')}  # chưa có tên trong file điểm danh
NAME_TYPO = {('KTPM2411', '920', PTTK, 2): 'Tuấn'}  # D3 → cảnh báo NAME_MISMATCH


def default_abs(n, course, idx):
    """Sinh viên sạch: vắng tăng dần, số cuối luôn dưới 10%."""
    m = int(n)
    final = (m % 3, m % 4) if course[3] == 60 else (m % 2, (m + 1) % 2)
    k = len(dates_of(course))
    return tuple(v * (idx + 1) // k for v in final)


# Trắc nghiệm: (lớp, sv, học phần, mã bài) → 'NONE' | [điểm từng lượt] | ('LATE', 'YYYY-MM-DD', điểm)
QUIZ = {
    ('KTPM2411', '905', LOG, 'TN01'): 'NONE', ('KTPM2411', '905', LOG, 'TN02'): 'NONE',
    ('KTPM2411', '906', LOG, 'TN01'): [3, 4], ('KTPM2411', '906', LOG, 'TN02'): [4.5],
    ('KTPM2411', '907', LOG, 'TN01'): [5], ('KTPM2411', '907', LOG, 'TN02'): [3],
    ('CNTT2411', '903', KTMT, 'TN01'): 'NONE', ('CNTT2411', '903', KTMT, 'TN02'): 'NONE',
    ('CNTT2411', '904', LOG, 'TN02'): 'NONE',
    ('CNTT2411', '905', KTMT, 'TN01'): [3, 4.5], ('CNTT2411', '905', KTMT, 'TN02'): [4],
    ('CNTT2411', '906', KTMT, 'TN01'): [5], ('CNTT2411', '906', KTMT, 'TN02'): [3],
    ('CNTT2411', '908', KTMT, 'TN01'): 'NONE',
    ('CNTT2411', '913', KTMT, 'TN01'): [3], ('CNTT2411', '913', KTMT, 'TN02'): 'NONE',
    ('CNTT2411', '914', KTMT, 'TN02'): ('LATE', '2025-10-15', 8),
    ('CNTT2411', '915', KTMT, 'TN01'): [2, 4, 6], ('CNTT2411', '915', KTMT, 'TN02'): [3],
    ('KHMT2411', '903', TTNT, 'TN01'): 'NONE',
    ('KHMT2411', '904', GT, 'TN01'): [4], ('KHMT2411', '904', GT, 'TN02'): [4], ('KHMT2411', '904', GT, 'TN03'): [3],
    ('KHMT2411', '906', TTNT, 'TN01'): 'NONE', ('KHMT2411', '906', TTNT, 'TN02'): ('LATE', '2025-10-15', 8),
    ('KHMT2411', '912', GT, 'TN03'): 'NONE',
    ('KHDL2411', '905', TTHCM, 'TN02'): 'NONE',
}


def default_quiz(n):
    m = int(n)
    score = [7, 8, 9, 6.5][m % 4]
    return [score - 1, score] if m % 5 == 0 else [score]


# Thực hành: (lớp, sv, học phần, mã bài) → (trạng thái, thời điểm nộp[, hạn riêng])
SUB = {
    ('KTPM2411', '908', HQT, 'TH01'): ('Chưa nộp', None), ('KTPM2411', '908', HQT, 'TH02'): ('Chưa nộp', None),
    ('KTPM2411', '909', HQT, 'TH01'): ('Nộp trễ', '2025-09-27 21:00'), ('KTPM2411', '909', HQT, 'TH02'): ('Nộp trễ', '2025-10-07 21:00'),
    ('KTPM2411', '910', PTTK, 'TH01'): ('Chưa nộp', None),
    ('KTPM2411', '911', PTTK, 'TH01'): ('Nộp trễ', '2025-10-02 21:00'), ('KTPM2411', '911', PTTK, 'TH02'): ('Nộp trễ', '2025-10-09 21:00'),
    ('KTPM2411', '912', HQT, 'TH03'): ('Chưa nộp', None),
    ('CNTT2411', '903', MANG, 'TH01'): ('Chưa nộp', None), ('CNTT2411', '903', MANG, 'TH02'): ('Chưa nộp', None),
    ('CNTT2411', '907', MANG, 'TH01'): ('Nộp trễ', '2025-09-27 21:00'), ('CNTT2411', '907', MANG, 'TH02'): ('Nộp trễ', '2025-10-07 21:00'),
    ('CNTT2411', '908', KTMT, 'TH01'): ('Chưa nộp', None),
    ('CNTT2411', '909', MANG, 'TH03'): ('Chưa nộp', None),
    ('CNTT2411', '910', MANG, 'TH02'): ('Chưa nộp', None, '2025-10-15'),
    ('CNTT2411', '911', KTMT, 'TH01'): ('Đã nộp', '2025-10-11 21:00', '2025-10-12'),
    ('CNTT2411', '911', KTMT, 'TH02'): ('Nộp trễ', '2025-10-08 21:00'),
    ('CNTT2411', '912', MANG, 'TH01'): ('Nộp trễ', '2025-09-27 21:00'),
    ('HTTT2411', '904', CSDL, 'TH01'): ('Chưa nộp', None), ('HTTT2411', '904', CSDL, 'TH02'): ('Chưa nộp', None),
    ('KHMT2411', '903', TTNT, 'TH01'): ('Chưa nộp', None),
    ('KHMT2411', '905', TTNT, 'TH01'): ('Chưa nộp', None), ('KHMT2411', '905', TTNT, 'TH03'): ('Chưa nộp', None),
    ('KHMT2411', '908', TTNT, 'TH01'): ('Nộp trễ', '2025-09-27 21:00'), ('KHMT2411', '908', TTNT, 'TH02'): ('Nộp trễ', '2025-10-07 21:00'),
    ('KHMT2411', '910', TTNT, 'TH02'): ('Chưa nộp', None),
}

BASE_BY_MOD = {0: 'A', 1: 'B+', 2: 'B', 3: 'C+'}


def base_grade(cls, n):
    return 'B' if cls in ('KTPM2411', 'HTTT2411') else BASE_BY_MOD[int(n) % 4]


# Kết quả HK1_2025: (lớp, sv) → {học phần: điểm chữ | None (chưa có kết quả)}; mặc định điểm nền.
GRADES = {
    ('KTPM2411', '901'): {LOG: 'A', HQT: 'A', PTTK: 'B+'},
    ('KTPM2411', '903'): {HQT: 'F'},
    ('KTPM2411', '904'): {HQT: 'C'},
    ('KTPM2411', '905'): {LOG: 'D'},
    ('KTPM2411', '906'): {LOG: 'C', PTTK: 'B+'},
    ('KTPM2411', '908'): {HQT: 'D', PTTK: 'C'},
    ('KTPM2411', '910'): {HQT: 'C', PTTK: 'C'},
    ('KTPM2411', '911'): {PTTK: 'C+'},
    ('KTPM2411', '913'): {LOG: 'F', HQT: 'B+'},
    ('KTPM2411', '914'): {LOG: 'F'},
    ('KTPM2411', '915'): {LOG: 'D', HQT: 'F', PTTK: 'F'},
    ('KTPM2411', '916'): {LOG: 'C', HQT: 'C', PTTK: 'C'},
    ('KTPM2411', '917'): {LOG: 'D', HQT: 'D+', PTTK: 'C'},
    ('KTPM2411', '918'): {LOG: 'C', HQT: 'A', PTTK: 'F'},
    ('KTPM2411', '919'): {LOG: 'F', PTTK: None},
    ('KTPM2411', '920'): {LOG: 'B+', HQT: 'B+', PTTK: 'A'},
    ('HTTT2411', '901'): {LOG: 'A+', HQT: 'A+', PTTK: 'A+'},
    ('HTTT2411', '903'): {CSDL: 'C'},
    ('HTTT2411', '904'): {HQT: 'C+', CSDL: 'D'},
    ('HTTT2411', '906'): {LOG: 'C', HQT: 'C+', PTTK: 'C'},
    ('HTTT2411', '907'): {LOG: 'C+', HQT: 'C+', PTTK: 'C+'},
    ('HTTT2411', '908'): {LOG: 'F', HQT: 'F', PTTK: 'C'},
    ('HTTT2411', '909'): {PTTK: 'F'},
    ('HTTT2411', '910'): {LOG: 'C', HQT: 'C', PTTK: 'C'},
    ('HTTT2411', '911'): {CSDL: 'C'},
    ('HTTT2411', '912'): {CSDL: 'D'},
    ('HTTT2411', '913'): {LOG: 'D', HQT: 'D', PTTK: 'D'},
    ('KHMT2411', '913'): {LOG: 'F', GT: 'B', TTNT: None},
    ('KHDL2411', '903'): {PTCSDL: None},
    ('KTPM2511', '902'): {TOAN: 'D+', NNLT1: 'F'},
    ('KTPM2511', '903'): {TOAN: 'D', NNLT1: 'F'},
    ('KTPM2511', '904'): {TOAN: 'F', NNLT1: 'C'},
}
EXAM_FLAGS = {  # (lớp, sv, học phần) → (được dự thi, vắng thi)
    ('KTPM2411', '913', LOG): ('Không', 'Không'),
    ('KTPM2411', '914', LOG): ('Có', 'Có'),
    ('KTPM2411', '903', HQT): ('Không', 'Không'),
}

# Kết quả HK3_2024: (lớp, sv) → 1 điểm chữ cho cả 6 học phần | {mã học phần: điểm chữ}.
HK3 = {
    ('KTPM2411', '903'): 'C+', ('KTPM2411', '908'): 'C+', ('KTPM2411', '916'): 'C+',
    ('KTPM2411', '917'): 'C+', ('KTPM2411', '918'): 'C+', ('KTPM2411', '919'): 'C+',
    ('KTPM2411', '915'): 'D',
    ('HTTT2411', '901'): 'A+',
    ('HTTT2411', '903'): {'0101000894': 'F'}, ('HTTT2411', '904'): {'0101000894': 'F'},
    ('HTTT2411', '905'): {'0101000894': 'F'}, ('HTTT2411', '911'): {'0101000894': 'F'},
    ('HTTT2411', '912'): {'0101000894': 'F'},
    ('HTTT2411', '906'): 'B+', ('HTTT2411', '907'): 'B+', ('HTTT2411', '909'): 'C+', ('HTTT2411', '910'): 'C',
    ('HTTT2411', '913'): 'D+',
    ('HTTT2411', '908'): {'0101000889': 'F', '0101000894': 'D', '0101000895': 'F', '0101002295': 'D',
                          '0101002335': 'C', '0101000714': 'F'},
    ('KHMT2411', '913'): 'C',
}

SCORES = {  # điểm chữ → (thường xuyên, cuối kỳ), tổng kết 40/60 rơi đúng dải
    'A+': (9.5, 9.7), 'A': (8.5, 9.0), 'B+': (8.0, 8.3), 'B': (7.0, 7.5), 'C+': (6.5, 6.8), 'C': (6.0, 5.8),
    'D+': (5.0, 5.2), 'D': (4.5, 4.2), 'F': (3.0, 2.5),
}
POINT4 = {'A+': '4.0', 'A': '3.8', 'B+': '3.5', 'B': '3.0', 'C+': '2.5', 'C': '2.0', 'D+': '1.5', 'D': '1.0', 'F': '0.0'}

STUDENT_HEADER = ['mssv', 'ho_ten', 'email', 'ma_lop_sinh_hoat', 'trang_thai_hoc_vu']
RESULT_HEADER = ['mssv', 'ho_dem', 'ten', 'ma_lop_hoc_phan', 'ma_hoc_phan', 'ten_hoc_phan', 'so_tin_chi',
                 'diem_thuong_xuyen', 'duoc_du_thi', 'diem_cuoi_ky', 'vang_thi', 'thang_diem_4', 'diem_chu',
                 'ngay_cong_bo']
ATT_HEADER = ['mssv', 'ho_dem', 'ten', 'ma_lop_hoc_phan', 'ma_hoc_phan', 'ten_hoc_phan', 'ngay_chot',
              'tong_so_tiet', 'vang_co_phep', 'vang_khong_phep', 'ty_le_vang']


def student_row(cls, n, status='ACTIVE', klass=None):
    ho, ten = NAME_OF[(cls, n)]
    return [MSSV(cls, n), f'{ho} {ten}', f'{slug(ten)}.{cls.lower()}{n}@student.ctuet.edu.vn', klass or cls, status]


def result_row(cls, n, sec, code, name, credits, grade, published, flags=('Có', 'Không')):
    ho, ten = NAME_OF[(cls, n)]
    tx, ck = SCORES[grade]
    eligible, absent = flags
    if eligible == 'Không':
        ck = None
    if absent == 'Có':
        ck = 0
    return [MSSV(cls, n), ho, ten, sec, code, name, credits, tx, eligible, ck, absent, POINT4[grade], grade, published]


def att_row(cls, n, sec, course, date, cp, kp, ten_override=None, rate=None):
    ho, ten = NAME_OF[(cls, n)]
    return [MSSV(cls, n), ho, ten_override or ten, sec, explicit_code(cls, course), course[1], date, course[3], cp, kp,
            rate if rate is not None else f'{(cp + kp) * 100 / course[3]:.2f}']


def gen_students():
    rows = [student_row(c, n, STATUS.get((c, n), 'ACTIVE')) for c in CLASSES for n in ALL[c]]
    write('01_sinh_vien.csv', STUDENT_HEADER, rows)


def gen_prior_terms():
    # HK2_2024: 1 dòng — lần rớt đầu tiên của HTTT 911 (để lần học ở HK1_2025 là lần 3).
    code, name, credits = HK3_COURSES[1]
    sec = code + CLASSES['HTTT2411']
    write(f'02_HK2_2024_ket_qua/{sec}.csv', RESULT_HEADER,
          [result_row('HTTT2411', '911', sec, code, name, credits, 'F', '2025-05-02')])
    # HK3_2024: mã học phần ghi rõ, 1 file / lớp học phần.
    for cls in COHORT_2024:
        for code, name, credits in HK3_COURSES:
            sec = code + CLASSES[cls]
            out = []
            for n in ALL[cls]:
                if (cls, n) in TRANSFERRED:
                    continue
                spec = HK3.get((cls, n), base_grade(cls, n))
                grade = spec if isinstance(spec, str) else spec.get(code, base_grade(cls, n))
                out.append(result_row(cls, n, sec, code, name, credits, grade, '2025-08-15'))
            write(f'03_HK3_2024_ket_qua/{sec}.csv', RESULT_HEADER, out)


def gen_attendance():
    for idx, date in enumerate(DATES):
        folder = '04_HK1_2025_diem_danh_dot_1' if idx < 2 else '05_HK1_2025_diem_danh_dot_2'
        for cls, courses in COURSES.items():
            for course in courses:
                if date not in dates_of(course):
                    continue
                sec = section(cls, course)
                out = []
                for n in roster(cls, course):
                    if (cls, n) in NO_ATTENDANCE:
                        continue
                    spec = ABS.get((cls, n, course))
                    cp, kp = spec[idx] if spec else default_abs(n, course, idx)
                    out.append(att_row(cls, n, sec, course, date, cp, kp, NAME_TYPO.get((cls, n, course, idx))))
                write(f'{folder}/{sec}_{date}.csv', ATT_HEADER, out)


def gen_quizzes():
    header = ['mssv', 'ho_dem', 'ten', 'ma_lop_hoc_phan', 'ma_hoc_phan', 'ma_bai', 'ten_bai', 'han_nop', 'lan_lam',
              'thoi_diem_bat_dau', 'thoi_diem_nop', 'thoi_gian_lam_phut', 'diem', 'diem_toi_da', 'so_cau_dung',
              'tong_so_cau', 'trang_thai']
    for cls, courses in COURSES.items():
        for course in courses:
            if course not in QUIZ_DUE:
                continue
            sec = section(cls, course)
            out = []
            for key, name, due in QUIZ_DUE[course]:
                y, m, d = NO_DUE_ATTEMPT_DAY if due is None else map(int, due.split('-'))
                for n in roster(cls, course):
                    ho, ten = NAME_OF[(cls, n)]
                    spec = QUIZ.get((cls, n, course, key), default_quiz(n))
                    base = [MSSV(cls, n), ho, ten, sec, explicit_code(cls, course), key, name, due]
                    if spec == 'NONE':
                        out.append(base + [None, None, None, None, None, 10, None, 10, 'Chưa làm'])
                    elif isinstance(spec, tuple):  # làm sau hạn
                        _, day, score = spec
                        out.append(base + [1, f'{day} 20:10', f'{day} 20:30', 20, score, 10, int(score), 10, 'Đã nộp'])
                    else:
                        for i, score in enumerate(spec):
                            day = f'{y:04d}-{m:02d}-{d - 2 + i:02d}'
                            minute = int(n) % 30
                            out.append(base + [i + 1, f'{day} 20:{minute + 10:02d}', f'{day} 20:{minute + 30:02d}', 20,
                                               score, 10, int(score), 10, 'Đã nộp'])
            write(f'06_HK1_2025_trac_nghiem/{sec}.csv', header, out)


def gen_assignments():
    header = ['mssv', 'ho_dem', 'ten', 'ma_lop_hoc_phan', 'ma_hoc_phan', 'ma_bai', 'ten_bai', 'han_nop',
              'trang_thai_nop', 'thoi_diem_nop', 'han_rieng']
    for cls, courses in COURSES.items():
        for course in courses:
            if course not in ASSIGN_DUE:
                continue
            sec = section(cls, course)
            out = []
            for key, name, due in ASSIGN_DUE[course]:
                y, m, d = map(int, due.split('-'))
                early = '2025-10-08 19:30' if due == '2025-10-14' else f'{y:04d}-{m:02d}-{d - 2:02d} 19:30'
                for n in roster(cls, course):
                    ho, ten = NAME_OF[(cls, n)]
                    spec = SUB.get((cls, n, course, key), ('Đã nộp', early))
                    status, when = spec[0], spec[1]
                    extended = spec[2] if len(spec) > 2 else None
                    out.append([MSSV(cls, n), ho, ten, sec, explicit_code(cls, course), key, name, due, status, when,
                                extended])
            write(f'07_HK1_2025_thuc_hanh/{sec}.csv', header, out)


def gen_results():
    for cls, courses in COURSES.items():
        for course in courses:
            sec = section(cls, course)
            published = '2025-11-16' if course == LOG else '2025-12-28'
            folder = '08_HK1_2025_ket_qua_logic_hoc' if course == LOG else '09_HK1_2025_ket_qua_cuoi_ky'
            out = []
            for n in roster(cls, course):
                grade = GRADES.get((cls, n), {}).get(course, base_grade(cls, n))
                if grade is None:
                    continue
                flags = EXAM_FLAGS.get((cls, n, course), ('Có', 'Không'))
                out.append(result_row(cls, n, sec, explicit_code(cls, course), course[1], course[2], grade,
                                      published, flags))
            write(f'{folder}/{sec}.csv', RESULT_HEADER, out)


def gen_error_samples():
    """File minh họa nhập lỗi, không nhập khi demo:reset (KET_QUA_MONG_DOI.md)."""
    cls, course, date = 'KHDL2411', XSTK, '2025-10-16'
    sec = section(cls, course)
    good = [att_row(cls, n, sec, course, date, 0, 0) for n in ['901', '902', '904']]
    write('minh-hoa-loi/01_sinh_vien_sai_lop.csv', STUDENT_HEADER,
          [student_row('KHDL2411', '901'), student_row('KHDL2411', '902', klass='KHDL9999')])
    write('minh-hoa-loi/02_diem_danh_sai_ngay_va_ma_sv.csv', ATT_HEADER, good + [
        ['KHDL2411999', 'Không', 'Có', sec, None, course[1], date, 30, 0, 1, '3.33'],
        att_row(cls, '907', sec, course, '10/2/2025', 0, 0)])
    write('minh-hoa-loi/03_diem_danh_trung_dong.csv', ATT_HEADER, good + [good[0]])
    write('minh-hoa-loi/04_diem_danh_vuot_so_tiet.csv', ATT_HEADER,
          good + [att_row(cls, '907', sec, course, date, 20, 15, rate='116.67')])
    write('minh-hoa-loi/05_diem_danh_sai_ngoai_hoc_ky.csv', ATT_HEADER,
          good + [att_row(cls, '907', sec, course, '2026-03-02', 0, 0)])
    other = section('KTPM2411', HQT)
    write('minh-hoa-loi/06_diem_danh_sai_hoc_phan.csv', ATT_HEADER,
          [att_row('KTPM2411', n, other, HQT, date, 0, 0) for n in ['901', '902', '903']])
    write('minh-hoa-loi/07_diem_danh_lech_ty_le.csv', ATT_HEADER,
          good + [att_row(cls, '907', sec, course, date, 1, 2, rate='50.00')])


def main():
    for d in DIRS:
        shutil.rmtree(os.path.join(OUT, d), ignore_errors=True)
    gen_students()
    gen_prior_terms()
    gen_attendance()
    gen_quizzes()
    gen_assignments()
    gen_results()
    gen_error_samples()
    print('ok')


main()
