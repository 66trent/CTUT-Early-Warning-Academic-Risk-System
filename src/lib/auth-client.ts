'use client';

import { createAuthClient } from 'better-auth/react';

/** Client Better Auth — cùng origin với app, không cần baseURL. */
export const authClient = createAuthClient();
