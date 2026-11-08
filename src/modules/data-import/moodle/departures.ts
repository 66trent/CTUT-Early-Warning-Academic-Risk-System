/**
 * Phát hiện dữ liệu đã xóa trên Moodle (thuần — Phase 10c, người dùng chốt 2026-11-08): sinh viên rời
 * khóa, bài bị xóa. EWARS KHÔNG tự xóa — chỉ liệt kê cho Admin (đánh dấu Rút học phần ở hồ sơ).
 */
import {
  type MoodleLeftStudent,
  type MoodleRemovedActivity,
  type MoodleSeenActivity,
} from '@/db/entities/moodle-course-link.entity';

export interface DepartureState {
  seenStudentIds: string[];
  leftStudents: MoodleLeftStudent[];
  seenActivities: MoodleSeenActivity[];
  removedActivities: MoodleRemovedActivity[];
}

const activityKey = (a: Pick<MoodleSeenActivity, 'kind' | 'id'>) => `${a.kind}|${a.id}`;

/**
 * Trạng thái mới sau 1 lần kéo đủ: có ở lần trước mà không còn → thêm vào danh sách; quay lại → bỏ
 * khỏi danh sách. Lần kéo đầu (chưa thấy gì) không báo ai.
 */
export function nextDepartures(
  previous: DepartureState,
  currentStudentIds: readonly string[],
  currentActivities: readonly MoodleSeenActivity[],
  now: Date,
): DepartureState {
  const at = now.toISOString();
  const students = new Set(currentStudentIds);
  const leftStudents = previous.leftStudents.filter((s) => !students.has(s.studentId));
  const alreadyLeft = new Set(leftStudents.map((s) => s.studentId));
  for (const id of previous.seenStudentIds) {
    if (!students.has(id) && !alreadyLeft.has(id))
      leftStudents.push({ studentId: id, detectedAt: at });
  }

  const activities = new Set(currentActivities.map(activityKey));
  const removedActivities = previous.removedActivities.filter(
    (a) => !activities.has(activityKey(a)),
  );
  const alreadyRemoved = new Set(removedActivities.map(activityKey));
  for (const a of previous.seenActivities) {
    if (!activities.has(activityKey(a)) && !alreadyRemoved.has(activityKey(a))) {
      removedActivities.push({ kind: a.kind, id: a.id, name: a.name, detectedAt: at });
    }
  }
  return {
    seenStudentIds: [...students].sort(),
    leftStudents: leftStudents.sort((a, b) => a.studentId.localeCompare(b.studentId)),
    seenActivities: [...currentActivities],
    removedActivities,
  };
}
