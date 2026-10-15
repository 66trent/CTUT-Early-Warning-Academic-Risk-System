/** Chạy 1 lần khi server Next.js khởi động (chỉ Node.js runtime). */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { assertEnvOrExit } = await import('./instrumentation-node');
    await assertEnvOrExit();
  }
}
