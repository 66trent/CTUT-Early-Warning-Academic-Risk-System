import { type ImportDataType } from '@/db/enums';
import { type ImportTypeDefinition } from './definition';
import { attendanceImport } from './attendance.import';
import { courseResultImport } from './course-result.import';
import { lmsAssignmentImport } from './lms-assignment.import';
import { lmsQuizImport } from './lms-quiz.import';
import { studentImport } from './student.import';

/**
 * Registry DUY NHẤT các loại nhập (docs/rules/12), theo thứ tự nạp trong quy trình vận hành.
 * Khung nhập chỉ duyệt registry — thêm loại = thêm 1 file + 1 dòng ở đây.
 */
const DEFINITIONS: Record<ImportDataType, ImportTypeDefinition<unknown>> = {
  STUDENT: studentImport,
  ATTENDANCE_SUMMARY: attendanceImport,
  LMS_QUIZ: lmsQuizImport,
  LMS_ASSIGNMENT: lmsAssignmentImport,
  COURSE_RESULT: courseResultImport,
};

export function getImportDefinition(dataType: string): ImportTypeDefinition<unknown> | null {
  return DEFINITIONS[dataType as ImportDataType] ?? null;
}

export function availableImportTypes(): {
  dataType: ImportDataType;
  label: string;
  requiresTerm: boolean;
  templatePath: string;
}[] {
  return Object.values(DEFINITIONS).map((d) => ({
    dataType: d.dataType,
    label: d.label,
    requiresTerm: d.requiresTerm,
    templatePath: d.templatePath,
  }));
}
