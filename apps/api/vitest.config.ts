import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts', 'test/**/*.e2e.spec.ts'],
    globals: false,
    pool: 'forks', // NestJS yavaş açılıyor, paralel test'lerde memory basıncını azaltır
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
});
