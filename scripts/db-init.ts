/**
 * npm run db:init — chạy TRƯỚC migration TypeORM (docs/rules/01).
 * Tạo extension uuid-ossp, schema `auth` và bảng của Better Auth trong schema đó.
 * Idempotent: chạy lại nhiều lần không lỗi. KHÔNG thêm cột riêng vào bảng auth.*.
 */
import 'dotenv/config';
import pg from 'pg';
import { getEnv } from '../src/lib/env';

const BETTER_AUTH_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS auth."user" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "emailVerified" boolean NOT NULL DEFAULT false,
  "image" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth."session" (
  "id" text PRIMARY KEY,
  "expiresAt" timestamptz NOT NULL,
  "token" text NOT NULL UNIQUE,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "ipAddress" text,
  "userAgent" text,
  "userId" text NOT NULL REFERENCES auth."user" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS auth."account" (
  "id" text PRIMARY KEY,
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "userId" text NOT NULL REFERENCES auth."user" ("id") ON DELETE CASCADE,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  "scope" text,
  "password" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth."verification" (
  "id" text PRIMARY KEY,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth."rateLimit" (
  "id" text PRIMARY KEY,
  "key" text NOT NULL UNIQUE,
  "count" integer NOT NULL,
  "lastRequest" bigint NOT NULL
);

CREATE INDEX IF NOT EXISTS "session_userId_idx" ON auth."session" ("userId");
CREATE INDEX IF NOT EXISTS "account_userId_idx" ON auth."account" ("userId");
CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON auth."verification" ("identifier");
`;

async function main(): Promise<void> {
  const env = getEnv();
  const client = new pg.Client({ connectionString: env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public');
    await client.query('CREATE SCHEMA IF NOT EXISTS auth');
    await client.query(BETTER_AUTH_TABLES_SQL);
    await client.query('COMMIT');
    console.log('db:init xong — extension uuid-ossp, schema auth và bảng Better Auth đã sẵn sàng.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error('db:init lỗi:', error instanceof Error ? error.message : error);
  process.exit(1);
});
