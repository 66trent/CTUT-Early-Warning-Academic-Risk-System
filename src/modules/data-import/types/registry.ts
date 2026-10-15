import { type ImportDataType } from '@/db/enums';
import { type ImportTypeDefinition } from './definition';
import { studentImport } from './student.import';

/**
 * Registry DUY NHẤT các loại nhập. Phase 3b thêm ATTENDANCE_SUMMARY, LMS_QUIZ, COURSE_RESULT.
 * Khung nhập chỉ duyệt registry — thêm loại = thêm 1 file + 1 dòng ở đây.
 */
const DEFINITIONS: Partial<Record<ImportDataType, ImportTypeDefinition<unknown>>> = {
  STUDENT: studentImport,
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
