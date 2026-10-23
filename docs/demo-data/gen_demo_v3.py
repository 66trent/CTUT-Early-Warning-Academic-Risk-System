"""Sinh bộ dữ liệu demo v3 (Phase 9b) vào docs/demo-data. Chạy ở thư mục gốc dự án:
    python -I docs/demo-data/gen_demo_v3.py .
Mọi số liệu tình huống là hằng ở đây và khớp KET_QUA_MONG_DOI.md — sửa file kết quả mong đợi TRƯỚC.
Sinh viên không có trong bảng tình huống nhận dữ liệu "sạch" (vắng 0, nộp đủ đúng hạn, điểm B).
"""
import csv, io, os, shutil, sys

ROOT = sys.argv[1]
OUT = os.path.join(ROOT, 'docs', 'demo-data')

DIRS = ['02_HK3_2024_ket_qua', '03_HK1_2025_diem_danh', '04_HK1_2025_trac_nghiem',
        '05_HK1_2025_thuc_hanh', '06_HK1_2025_ket_qua_logic_hoc', '07_HK1_2025_ket_qua_cuoi_ky',
        'minh-hoa-loi']


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


NAMES = [
    ('901', 'Nguyễn Minh', 'An'), ('902', 'Trần Thị', 'Bích'), ('903', 'Lê Văn', 'Cường'),
    ('904', 'Phạm Thị', 'Dung'), ('905', 'Hoàng Văn', 'Em'), ('906', 'Võ Thị', 'Giang'),
    ('907', 'Đặng Văn', 'Hải'), ('908', 'Bùi Thị', 'Hoa'), ('909', 'Đỗ Văn', 'Khánh'),
    ('910', 'Ngô Thị', 'Lan'), ('911', 'Dương Văn', 'Long'), ('912', 'Lý Thị', 'Mai'),
    ('913', 'Huỳnh Văn', 'Nam'), ('914', 'Phan Thị', 'Oanh'), ('915', 'Vũ Văn', 'Phúc'),
    ('916', 'Trương Thị', 'Quỳnh'), ('917', 'Mai Văn', 'Sơn'), ('918', 'Hồ Thị', 'Thảo'),
    ('919', 'Tạ Văn', 'Uy'), ('920', 'Đặng Minh', 'Tú'),
]
SLUG = {'An': 'an', 'Bích': 'bich', 'Cường': 'cuong', 'Dung': 'dung', 'Em': 'em', 'Giang': 'giang',
        'Hải': 'hai', 'Hoa': 'hoa', 'Khánh': 'khanh', 'Lan': 'lan', 'Long': 'long', 'Mai': 'mai',
        'Nam': 'nam', 'Oanh': 'oanh', 'Phúc': 'phuc', 'Quỳnh': 'quynh', 'Sơn': 'son', 'Thảo': 'thao',
        'Uy': 'uy', 'Tú': 'tu'}
NAME_OF = {n: (ho, ten) for n, ho, ten in NAMES}
ALL = [n for n, _, _ in NAMES]

# Lớp → số thứ tự lớp học phần (mã lớp học phần = mã học phần + 2 số).
CLASSES = {'CNTT2411': '01', 'KTPM2411': '02', 'HTTT2411': '03', 'KHMT2411': '04', 'KHDL2411': '05'}

# Học phần (chuong-trinh-khung-ktpm.md): mã, tên, tín chỉ, tổng tiết.
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

HK3_COURSES = [('0101000889', 'Toán rời rạc', 3), ('0101000894', 'Cơ sở dữ liệu', 3),
               ('0101000895', 'Lập trình hướng đối tượng', 3), ('0101002295', 'Cấu trúc dữ liệu', 2),
               ('0101002335', 'Chủ nghĩa xã hội khoa học', 2), ('0101000714', 'Anh văn căn bản 3', 3)]

# Lớp học phần học lại Cơ sở dữ liệu (HTTT) — ghi rõ mã học phần.
CSDL_RETAKE_SECTION = '010100089401'
RETAKERS = ['903', '904', '905']

COURSES = {  # lớp → học phần HK1_2025 (thứ tự trong file)
    'CNTT2411': [LOG, KTMT, MANG],
    'KTPM2411': [LOG, HQT, PTTK],
    'HTTT2411': [LOG, HQT, PTTK, CSDL],
    'KHMT2411': [LOG, GT, TTNT],
    'KHDL2411': [XSTK, TTHCM, PTCSDL],
}

QUIZ_DUE = {  # học phần → [(mã bài, tên, hạn)]
    LOG: [('TN01', 'Trắc nghiệm chương 1', '2025-09-20'), ('TN02', 'Trắc nghiệm chương 2', '2025-10-04')],
    HQT: [('TN01', 'Trắc nghiệm chương 1', '2025-09-27'), ('TN02', 'Trắc nghiệm chương 2', '2025-10-08')],
    KTMT: [('TN01', 'Trắc nghiệm chương 1', '2025-09-27'), ('TN02', 'Trắc nghiệm chương 2', '2025-10-08')],
    GT: [('TN01', 'Trắc nghiệm chương 1', '2025-09-27'), ('TN02', 'Trắc nghiệm chương 2', '2025-10-08')],
    TTNT: [('TN01', 'Trắc nghiệm chương 1', '2025-09-27'), ('TN02', 'Trắc nghiệm chương 2', '2025-10-08')],
    TTHCM: [('TN01', 'Trắc nghiệm chương 1', '2025-09-20'), ('TN02', 'Trắc nghiệm chương 2', '2025-10-04')],
}
TH3 = [('TH01', 'Thực hành 1', '2025-09-25'), ('TH02', 'Thực hành 2', '2025-10-05'), ('TH03', 'Thực hành 3', '2025-10-14')]
TH2 = [('TH01', 'Thực hành 1', '2025-09-30'), ('TH02', 'Thực hành 2', '2025-10-07')]
ASSIGN_DUE = {HQT: TH3, MANG: TH3, TTNT: TH3, PTTK: TH2, KTMT: TH2, CSDL: TH2, PTCSDL: TH2}


def section(cls, course):
    if cls == 'HTTT2411' and course == CSDL:
        return CSDL_RETAKE_SECTION
    return course[0] + CLASSES[cls]


def roster(cls, course):
    """Sinh viên học học phần ở học kỳ demo."""
    if cls == 'HTTT2411' and course == CSDL:
        return RETAKERS
    if cls == 'KHDL2411' and course != XSTK:
        return [n for n in ALL if n != '919']  # 919 chuyển đến, chỉ học XSTK
    return ALL


def explicit_code(cls, course):
    """Mã học phần ghi rõ: chỉ học phần học lại (KET_QUA_MONG_DOI.md — không phụ thuộc giả định)."""
    return course[0] if (cls == 'HTTT2411' and course == CSDL) else None


MSSV = lambda cls, n: f'{cls}{n}'

# ---------------------------------------------------------------- Tình huống (KET_QUA_MONG_DOI.md)
# Điểm danh: (lớp, sv, học phần) → [(có phép, không phép) ngày 02/10, ngày 09/10]
ABS = {
    ('KTPM2411', '902', LOG): [(1, 1), (1, 2)],
    ('KTPM2411', '903', HQT): [(2, 3), (2, 11)],
    ('KTPM2411', '904', HQT): [(0, 7), (0, 12)],
    ('KTPM2411', '907', LOG): [(0, 1), (0, 1)],
    ('KTPM2411', '910', PTTK): [(2, 5), (2, 5)],
    ('KTPM2411', '911', PTTK): [(0, 4), (0, 7)],
    ('KTPM2411', '913', LOG): [(0, 4), (0, 8)],
    ('KTPM2411', '920', PTTK): [(4, 0), (4, 0)],
    ('HTTT2411', '903', CSDL): [(0, 4), (0, 7)],
    ('KHMT2411', '903', TTNT): [(0, 3), (0, 7)],
    ('KHMT2411', '904', GT): [(0, 2), (0, 5)],
    ('KHMT2411', '908', TTNT): [(0, 6), (0, 6)],
    ('KHDL2411', '903', PTCSDL): [(2, 6), (4, 10)],
}
NO_ATTENDANCE = {('KHDL2411', '919')}  # chưa có tên trong file điểm danh
NAME_TYPO = {('KTPM2411', '920', PTTK, 1): 'Tuấn'}  # → cảnh báo NAME_MISMATCH

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
    ('KHMT2411', '903', TTNT, 'TN01'): 'NONE',
    ('KHMT2411', '904', GT, 'TN01'): [4], ('KHMT2411', '904', GT, 'TN02'): [4],
    ('KHMT2411', '906', TTNT, 'TN01'): 'NONE', ('KHMT2411', '906', TTNT, 'TN02'): ('LATE', '2025-10-15', 8),
    ('KHDL2411', '905', TTHCM, 'TN02'): 'NONE',
}
QUIZ_DEFAULT = {('KTPM2411', '901'): 9, ('KTPM2411', '920'): 9}  # còn lại 8

# Thực hành: (lớp, sv, học phần, mã bài) → ('Chưa nộp', None) | ('Nộp trễ', 'YYYY-MM-DD HH:mm')
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
    ('HTTT2411', '904', CSDL, 'TH01'): ('Chưa nộp', None), ('HTTT2411', '904', CSDL, 'TH02'): ('Chưa nộp', None),
    ('KHMT2411', '903', TTNT, 'TH01'): ('Chưa nộp', None),
    ('KHMT2411', '905', TTNT, 'TH01'): ('Chưa nộp', None), ('KHMT2411', '905', TTNT, 'TH03'): ('Chưa nộp', None),
    ('KHMT2411', '908', TTNT, 'TH01'): ('Nộp trễ', '2025-09-27 21:00'), ('KHMT2411', '908', TTNT, 'TH02'): ('Nộp trễ', '2025-10-07 21:00'),
}

# Kết quả HK1_2025: (lớp, sv) → {học phần: điểm chữ | None (chưa có kết quả)}; mặc định B.
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
    ('HTTT2411', '903'): {CSDL: 'C'},
    ('HTTT2411', '904'): {HQT: 'C+', CSDL: 'D'},
    ('HTTT2411', '906'): {LOG: 'C', HQT: 'C+', PTTK: 'C'},
    ('HTTT2411', '907'): {LOG: 'C+', HQT: 'C+', PTTK: 'C+'},
    ('HTTT2411', '908'): {LOG: 'F', HQT: 'F', PTTK: 'C'},
    ('HTTT2411', '909'): {PTTK: 'F'},
    ('HTTT2411', '910'): {LOG: 'C', HQT: 'C', PTTK: 'C'},
    ('KHDL2411', '903'): {PTCSDL: None},
}
EXAM_FLAGS = {  # (lớp, sv, học phần) → (được dự thi, vắng thi)
    ('KTPM2411', '913', LOG): ('Không', 'Không'),
    ('KTPM2411', '914', LOG): ('Có', 'Có'),
    ('KTPM2411', '903', HQT): ('Không', 'Không'),
}

# Kết quả HK3_2024: (lớp, sv) → 1 điểm chữ cho cả 6 học phần | {mã học phần: điểm chữ}; mặc định B.
HK3 = {
    ('KTPM2411', '903'): 'C+', ('KTPM2411', '908'): 'C+', ('KTPM2411', '916'): 'C+',
    ('KTPM2411', '917'): 'C+', ('KTPM2411', '918'): 'C+', ('KTPM2411', '919'): 'C+',
    ('KTPM2411', '915'): 'D',
    ('HTTT2411', '903'): {'0101000894': 'F'}, ('HTTT2411', '904'): {'0101000894': 'F'},
    ('HTTT2411', '905'): {'0101000894': 'F'},
    ('HTTT2411', '906'): 'B+', ('HTTT2411', '907'): 'B+', ('HTTT2411', '909'): 'C+', ('HTTT2411', '910'): 'C',
    ('HTTT2411', '908'): {'0101000889': 'F', '0101000894': 'D', '0101000895': 'F', '0101002295': 'D',
                          '0101002335': 'C', '0101000714': 'F'},
}
TRANSFERRED = {('KHDL2411', '918'), ('KHDL2411', '919'), ('KHDL2411', '920')}  # không có HK3_2024

SCORES = {  # điểm chữ → (thường xuyên, cuối kỳ), tổng kết 40/60 rơi đúng dải
    'A+': (9.5, 9.7), 'A': (8.5, 9.0), 'B+': (8.0, 8.3), 'B': (7.0, 7.5), 'C+': (6.5, 6.8), 'C': (6.0, 5.8),
    'D+': (5.0, 5.2), 'D': (4.5, 4.2), 'F': (3.0, 2.5),
}
POINT4 = {'A+': '4.0', 'A': '3.8', 'B+': '3.5', 'B': '3.0', 'C+': '2.5', 'C': '2.0', 'D+': '1.5', 'D': '1.0', 'F': '0.0'}

RESULT_HEADER = ['mssv', 'ho_dem', 'ten', 'ma_lop_hoc_phan', 'ma_hoc_phan', 'ten_hoc_phan', 'so_tin_chi',
                 'diem_thuong_xuyen', 'duoc_du_thi', 'diem_cuoi_ky', 'vang_thi', 'thang_diem_4', 'diem_chu',
                 'ngay_cong_bo']


def result_row(cls, n, sec, code, name, credits, grade, published, flags=('Có', 'Không')):
    ho, ten = NAME_OF[n]
    tx, ck = SCORES[grade]
    eligible, absent = flags
    if eligible == 'Không':
        ck = None
    if absent == 'Có':
        ck = 0
    return [MSSV(cls, n), ho, ten, sec, code, name, credits, tx, eligible, ck, absent, POINT4[grade], grade, published]


def main():
    for d in DIRS:
        shutil.rmtree(os.path.join(OUT, d), ignore_errors=True)

    # 01 — sinh viên (100)
    rows = []
    for cls in CLASSES:
        for n, ho, ten in NAMES:
            rows.append([MSSV(cls, n), f'{ho} {ten}', f'{SLUG[ten]}.{cls.lower()}{n}@student.ctuet.edu.vn', cls, 'ACTIVE'])
    write('01_sinh_vien.csv', ['mssv', 'ho_ten', 'email', 'ma_lop_sinh_hoat', 'trang_thai_hoc_vu'], rows)

    # 02 — kết quả HK3_2024 (mã học phần ghi rõ), 1 file / lớp học phần
    for cls, suffix in CLASSES.items():
        for code, name, credits in HK3_COURSES:
            sec = code + suffix
            out = []
            for n in ALL:
                if (cls, n) in TRANSFERRED:
                    continue
                spec = HK3.get((cls, n), 'B')
                grade = spec if isinstance(spec, str) else spec.get(code, 'B')
                out.append(result_row(cls, n, sec, code, name, credits, grade, '2025-08-15'))
            write(f'02_HK3_2024_ket_qua/{sec}.csv', RESULT_HEADER, out)

    # 03 — điểm danh, 1 file / lớp học phần / ngày chốt
    att_header = ['mssv', 'ho_dem', 'ten', 'ma_lop_hoc_phan', 'ma_hoc_phan', 'ten_hoc_phan', 'ngay_chot',
                  'tong_so_tiet', 'vang_co_phep', 'vang_khong_phep', 'ty_le_vang']
    for date_i, date in enumerate(['2025-10-02', '2025-10-09']):
        for cls, courses in COURSES.items():
            for course in courses:
                sec = section(cls, course)
                out = []
                for n in roster(cls, course):
                    if (cls, n) in NO_ATTENDANCE:
                        continue
                    ho, ten = NAME_OF[n]
                    cp, kp = ABS.get((cls, n, course), [(0, 0), (0, 0)])[date_i]
                    ten = NAME_TYPO.get((cls, n, course, date_i), ten)
                    out.append([MSSV(cls, n), ho, ten, sec, explicit_code(cls, course), course[1], date,
                                course[3], cp, kp, f'{(cp + kp) * 100 / course[3]:.2f}'])
                write(f'03_HK1_2025_diem_danh/{sec}_{date}.csv', att_header, out)

    # 04 — bài trắc nghiệm, 1 file / lớp học phần (mỗi bài 10 câu, điểm /10)
    quiz_header = ['mssv', 'ho_dem', 'ten', 'ma_lop_hoc_phan', 'ma_hoc_phan', 'ma_bai', 'ten_bai', 'han_nop',
                   'lan_lam', 'thoi_diem_bat_dau', 'thoi_diem_nop', 'thoi_gian_lam_phut', 'diem', 'diem_toi_da',
                   'so_cau_dung', 'tong_so_cau', 'trang_thai']
    for cls, courses in COURSES.items():
        for course in courses:
            if course not in QUIZ_DUE:
                continue
            sec = section(cls, course)
            out = []
            for key, name, due in QUIZ_DUE[course]:
                y, m, d = map(int, due.split('-'))
                for n in roster(cls, course):
                    ho, ten = NAME_OF[n]
                    spec = QUIZ.get((cls, n, course, key), [QUIZ_DEFAULT.get((cls, n), 8)])
                    base = [MSSV(cls, n), ho, ten, sec, explicit_code(cls, course), key, name, due]
                    if spec == 'NONE':
                        out.append(base + [None, None, None, None, None, 10, None, 10, 'Chưa làm'])
                        continue
                    if isinstance(spec, tuple):  # làm sau hạn
                        _, day, score = spec
                        out.append(base + [1, f'{day} 20:10', f'{day} 20:30', 20, score, 10, int(score), 10, 'Đã nộp'])
                        continue
                    for i, score in enumerate(spec):
                        dd = d - 2 + i
                        start = f'{y:04d}-{m:02d}-{dd:02d} 20:{int(n) % 30 + 10:02d}'
                        end = f'{y:04d}-{m:02d}-{dd:02d} 20:{int(n) % 30 + 30:02d}'
                        out.append(base + [i + 1, start, end, 20, score, 10, int(score), 10, 'Đã nộp'])
            write(f'04_HK1_2025_trac_nghiem/{sec}.csv', quiz_header, out)

    # 05 — bài thực hành, 1 file / lớp học phần. Mặc định nộp trước hạn 2 ngày (hạn 14/10 → 08/10).
    sub_header = ['mssv', 'ho_dem', 'ten', 'ma_lop_hoc_phan', 'ma_hoc_phan', 'ma_bai', 'ten_bai', 'han_nop',
                  'trang_thai_nop', 'thoi_diem_nop']
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
                    ho, ten = NAME_OF[n]
                    status, when = SUB.get((cls, n, course, key), ('Đã nộp', early))
                    out.append([MSSV(cls, n), ho, ten, sec, explicit_code(cls, course), key, name, due, status, when])
            write(f'05_HK1_2025_thuc_hanh/{sec}.csv', sub_header, out)

    # 06/07 — kết quả HK1_2025: Logic học công bố 16/11, còn lại 28/12
    for cls, courses in COURSES.items():
        for course in courses:
            sec = section(cls, course)
            published = '2025-11-16' if course == LOG else '2025-12-28'
            folder = '06_HK1_2025_ket_qua_logic_hoc' if course == LOG else '07_HK1_2025_ket_qua_cuoi_ky'
            out = []
            for n in roster(cls, course):
                grade = GRADES.get((cls, n), {}).get(course, 'B')
                if grade is None:
                    continue
                flags = EXAM_FLAGS.get((cls, n, course), ('Có', 'Không'))
                out.append(result_row(cls, n, sec, explicit_code(cls, course), course[1], course[2], grade,
                                      published, flags))
            write(f'{folder}/{sec}.csv', RESULT_HEADER, out)

    # Minh họa nhập lỗi (KHÔNG nạp khi demo:reset): điểm danh XSTK ngày 16/10 có 2 dòng lỗi.
    sec = section('KHDL2411', XSTK)
    out = []
    for n in roster('KHDL2411', XSTK):
        if ('KHDL2411', n) in NO_ATTENDANCE:
            continue
        ho, ten = NAME_OF[n]
        out.append([MSSV('KHDL2411', n), ho, ten, sec, None, XSTK[1], '2025-10-16', 30, 0, 0, '0.00'])
    out.append(['KHDL2411999', 'Không', 'Có', sec, None, XSTK[1], '2025-10-16', 30, 0, 1, '3.33'])
    out.append([MSSV('KHDL2411', '919'), 'Tạ Văn', 'Uy', sec, None, XSTK[1], '10/2/2025', 30, 0, 0, '0.00'])
    write(f'minh-hoa-loi/{sec}_2025-10-16_co_loi.csv', att_header, out)
    print('ok')


main()
