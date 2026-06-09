import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

/**
 * Vitest + NestJS uyumluluk notu:
 *   - Vite default olarak esbuild kullanır (TypeScript transform)
 *   - esbuild `emitDecoratorMetadata` desteklemiyor
 *   - NestJS DI için `design:paramtypes` metadata gerekli
 *   - Çözüm: SWC kullan (decorator metadata destekliyor)
 */
export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        parser: {
          syntax: 'typescript',
          decorators: true,
        },
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true,
        },
        target: 'es2022',
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts', 'test/**/*.e2e.spec.ts'],
    globals: false,
    pool: 'forks', // NestJS yavaş açılıyor, paralel test'lerde memory basıncını azaltır
    fileParallelism: false, // Tek DB paylaşılıyor — dosyalar arası paralellik race condition yaratır
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
});
