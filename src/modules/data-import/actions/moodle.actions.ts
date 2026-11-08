'use server';

import { UserRole } from '@/db/enums';
import { runAction } from '@/lib/action';
import { type ActionResult } from '@/lib/errors';
import { setMoodleSyncMode } from '../services/moodle-auto.service';
import { setMoodleLink } from '../services/moodle-link.service';
import {
  confirmMoodleSync,
  discardMoodleSync,
  requestMoodleSync,
} from '../services/moodle-sync.service';
import {
  moodleLinkSchema,
  moodleSyncRequestSchema,
  moodleSyncModeSchema,
  moodleSyncRunSchema,
} from '../validators/moodle';

/** Trang Kết nối Moodle (Phase 10b) — chỉ Admin; mọi thao tác ghi Audit Log trong service. */
const ADMIN = [UserRole.ADMIN] as const;
const REVALIDATE = ['/admin/moodle', '/admin/imports'];

export async function setMoodleLinkAction(raw: unknown): Promise<ActionResult<null>> {
  return runAction(raw, {
    roles: ADMIN,
    schema: moodleLinkSchema,
    revalidate: REVALIDATE,
    run: async (input, user) => {
      await setMoodleLink(input, user.userId);
      return null;
    },
  });
}

export async function requestMoodleSyncAction(
  raw: unknown,
): Promise<ActionResult<{ runIds: string[] }>> {
  return runAction(raw, {
    roles: ADMIN,
    schema: moodleSyncRequestSchema,
    revalidate: REVALIDATE,
    run: (input, user) => requestMoodleSync(input.termId, user.userId),
  });
}

export async function confirmMoodleSyncAction(
  raw: unknown,
): Promise<ActionResult<{ confirmed: number }>> {
  return runAction(raw, {
    roles: ADMIN,
    schema: moodleSyncRunSchema,
    revalidate: REVALIDATE,
    run: (input, user) => confirmMoodleSync(input.runId, user.userId),
  });
}

export async function discardMoodleSyncAction(
  raw: unknown,
): Promise<ActionResult<{ discarded: number }>> {
  return runAction(raw, {
    roles: ADMIN,
    schema: moodleSyncRunSchema,
    revalidate: REVALIDATE,
    run: (input, user) => discardMoodleSync(input.runId, user.userId),
  });
}

/** Chạy tay ↔ Tự động cho 1 khóa (Phase 10c). */
export async function setMoodleSyncModeAction(raw: unknown): Promise<ActionResult<null>> {
  return runAction(raw, {
    roles: ADMIN,
    schema: moodleSyncModeSchema,
    revalidate: REVALIDATE,
    run: async (input, user) => {
      await setMoodleSyncMode(input, user.userId);
      return null;
    },
  });
}
