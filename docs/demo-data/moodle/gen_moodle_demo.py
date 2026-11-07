"""Sinh dữ liệu Moodle demo (Phase 10a) → docs/demo-data/moodle/moodle-demo.json. Chạy ở thư mục gốc:
    python -I docs/demo-data/moodle/gen_moodle_demo.py .
File JSON được `integrations/moodle/cli/ewars_seed_demo.php` đọc để dựng khóa học, sinh viên,
buổi điểm danh, bài trắc nghiệm, bài thực hành trên Moodle 5.3 (docs/tich-hop-moodle.md mục 7).

Giả định demo (không xác minh với trường — người dùng chốt 2026-11-07):
- Học kỳ theo ngày thật HK1_2026 (17/08–27/12/2026); dữ liệu đến hết 06/11/2026, sau đó tự làm tay.
- Lớp KTPM2411 (20 sinh viên của bộ v3) học 2 học phần HK5 chương trình khung: Mạng máy tính
  (0101000892) và Hệ điều hành (0101000891), 60 tiết; Course ID number = mã lớp học phần 12 số.
- Mỗi tuần 1 buổi 200 phút = 4 tiết (1 tiết = 50 phút) × 15 tuần = 60 tiết; buổi sau 06/11 đã tạo
  lịch nhưng chưa điểm danh.
Sinh viên không có trong bảng TINH_HUONG: đi học đủ, làm mọi bài trắc nghiệm 7–10 điểm, nộp đúng hạn.
"""
import csv, json, os, sys
from datetime import date, datetime, timedelta

ROOT = sys.argv[1]
OUT = os.path.join(ROOT, 'docs', 'demo-data', 'moodle', 'moodle-demo.json')
STUDENTS_CSV = os.path.join(ROOT, 'docs', 'demo-data', '01_sinh_vien.csv')
CLASS_ID = 'KTPM2411'
CUTOFF = date(2026, 11, 6)
WEEKS = 15
SESSION_MINUTES = 200


def vn(d: date, hh: int, mm: int = 0) -> str:
    return datetime(d.year, d.month, d.day, hh, mm).strftime('%Y-%m-%dT%H:%M:00+07:00')


def students():
    with open(STUDENTS_CSV, encoding='utf-8-sig') as f:
        rows = [r for r in csv.DictReader(f) if r['ma_lop_sinh_hoat'] == CLASS_ID]
    out = []
    for r in rows:
        parts = r['ho_ten'].split()
        out.append({
            'mssv': r['mssv'],
            'username': r['mssv'].lower(),
            'lastname': ' '.join(parts[:-1]),
            'firstname': parts[-1],
            'email': r['email'],
        })
    return out


# Tình huống theo học phần (3 số cuối MSSV). A = vắng không phép, E = vắng có phép (theo tuần 1..15).
TINH_HUONG = {
    'MMT': {
        'absent': {'903': {3: 'A', 6: 'A', 9: 'A', 11: 'A'},   # 16/60 tiết = 26,7% → ATT-01 Rất cao
                   '906': {5: 'E', 8: 'E'}},                   # 8/60 = 13,3% có phép → ATT-01 TB
        'quiz_skip': {},
        'quiz_scores': {},
        'quiz_inprogress': {'917': 'TN02'},                    # làm dở, quá hạn không nộp → LMS-01 TB
        'assign_missing': {'907': ['TH01', 'TH02']},           # → LMS-03 Cao
        'assign_late': {'909': ['TH01', 'TH02']},              # → LMS-04 Thấp
        'extension': {'915': ('TH02', date(2026, 11, 20))},    # gia hạn, chưa nộp → KHÔNG cảnh báo
    },
    'HDH': {
        'absent': {'904': {11: 'A', 12: 'A'},                  # 2 buổi cuối: 13,3% + tăng 8 tiết/14 ngày → ATT-01 TB + ATT-02
                   '913': {4: 'A', 7: 'A'}},                   # 13,3% (TB) …
        'quiz_skip': {'905': ['TN01', 'TN02']},                # → LMS-01 Cao
        'quiz_scores': {'911': {'TN01': [4], 'TN02': [3]},     # 2 bài gần nhất < 50% → LMS-02 TB
                        '919': {'TN01': [5, 9]}},              # 2 lượt, lấy lượt cao nhất → không cảnh báo
        'quiz_inprogress': {},
        'assign_missing': {'913': ['TH01']},                   # … + bỏ 1 bài thực hành → COMB-01 Rất cao
        'assign_late': {},
        'extension': {},
    },
}

COURSES = [
    {'key': 'MMT', 'idnumber': '010100089201', 'courseCode': '0101000892', 'name': 'Mạng máy tính',
     'first': date(2026, 8, 18), 'hour': 7},
    {'key': 'HDH', 'idnumber': '010100089101', 'courseCode': '0101000891', 'name': 'Hệ điều hành',
     'first': date(2026, 8, 20), 'hour': 13},
]
QUIZZES = [('TN01', 'Trắc nghiệm chương 1', date(2026, 9, 8), date(2026, 9, 15)),
           ('TN02', 'Trắc nghiệm chương 2', date(2026, 10, 6), date(2026, 10, 13)),
           ('TN03', 'Trắc nghiệm chương 3', date(2026, 11, 17), date(2026, 11, 24))]
ASSIGNS = [('TH01', 'Thực hành 1', date(2026, 9, 8), date(2026, 9, 22)),
           ('TH02', 'Thực hành 2', date(2026, 10, 6), date(2026, 10, 20)),
           ('TH03', 'Thực hành 3', date(2026, 11, 2), date(2026, 11, 30))]


def build_course(c, studs):
    th = TINH_HUONG[c['key']]
    sessions = []
    for w in range(1, WEEKS + 1):
        d = c['first'] + timedelta(weeks=w - 1)
        taken = d <= CUTOFF
        statuses = {}
        if taken:
            for s in studs:
                statuses[s['mssv']] = th['absent'].get(s['mssv'][-3:], {}).get(w, 'P')
        sessions.append({'start': vn(d, c['hour']), 'durationMinutes': SESSION_MINUTES,
                         'taken': taken, 'statuses': statuses})

    quizzes = []
    for qi, (key, name, opened, due) in enumerate(QUIZZES):
        attempts = []
        if due <= CUTOFF:
            for si, s in enumerate(studs):
                suf = s['mssv'][-3:]
                if key in th['quiz_skip'].get(suf, []):
                    continue
                day = due - timedelta(days=1 + (si % 3))
                if th['quiz_inprogress'].get(suf) == key:
                    attempts.append({'mssv': s['mssv'], 'attempt': 1, 'start': vn(day, 20, si),
                                     'finish': None, 'correct': None})
                    continue
                scores = th['quiz_scores'].get(suf, {}).get(key, [7 + (si + qi) % 4])
                for n, correct in enumerate(scores, start=1):
                    t0 = day - timedelta(days=len(scores) - n)
                    attempts.append({'mssv': s['mssv'], 'attempt': n, 'start': vn(t0, 20, si),
                                     'finish': vn(t0, 20, si + 20), 'correct': correct})
        quizzes.append({'key': key, 'name': name, 'open': vn(opened, 0), 'due': vn(due, 23, 59),
                        'questions': 10, 'attempts': attempts})

    assigns = []
    for ai, (key, name, opened, due) in enumerate(ASSIGNS):
        subs, exts = [], []
        for si, s in enumerate(studs):
            suf = s['mssv'][-3:]
            ext = th['extension'].get(suf)
            if ext and ext[0] == key:
                exts.append({'mssv': s['mssv'], 'until': vn(ext[1], 23, 59)})
                continue
            if key in th['assign_missing'].get(suf, []):
                continue
            if key in th['assign_late'].get(suf, []):
                subs.append({'mssv': s['mssv'], 'submittedAt': vn(due + timedelta(days=2), 21)})
            elif due <= CUTOFF:
                subs.append({'mssv': s['mssv'], 'submittedAt': vn(due - timedelta(days=1 + si % 4), 19, si)})
            elif suf in ('901', '902'):  # nộp sớm bài chưa đến hạn
                subs.append({'mssv': s['mssv'], 'submittedAt': vn(CUTOFF - timedelta(days=1), 21)})
        assigns.append({'key': key, 'name': name, 'open': vn(opened, 0), 'due': vn(due, 23, 59),
                        'submissions': subs, 'extensions': exts})

    return {'idnumber': c['idnumber'], 'courseCode': c['courseCode'],
            'shortname': f"{c['key']}-{c['idnumber'][-2:]}-HK1-2026",
            'fullname': f"{c['name']} (nhóm {c['idnumber'][-2:]}) — HK1 2026–2027",
            'attendance': {'name': 'Điểm danh', 'sessions': sessions},
            'quizzes': quizzes, 'assignments': assigns}


def main():
    studs = students()
    assert len(studs) == 20, len(studs)
    spec = {
        'note': 'Sinh bởi gen_moodle_demo.py — đừng sửa tay.',
        'term': {'termId': 'HK1_2026', 'termName': 'Học kỳ 1, 2026–2027', 'academicYear': '2026-2027',
                 'startDate': '2026-08-17', 'endDate': '2026-12-27'},
        'dataCutoff': CUTOFF.isoformat(),
        'category': 'HK1 2026–2027',
        'teacher': {'username': 'gv.moodle', 'firstname': 'Demo', 'lastname': 'Giảng viên',
                    'email': 'gv.moodle@moodle.local'},
        'students': studs,
        'courses': [build_course(c, studs) for c in COURSES],
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(spec, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print('OK', OUT)


main()
