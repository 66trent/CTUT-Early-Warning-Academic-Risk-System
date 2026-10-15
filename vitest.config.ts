import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    setupFiles: ['tests/setup.ts'],
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: ['src/modules/**', 'src/lib/**'],
      reporter: ['text', 'html'],
    },
  },
});
