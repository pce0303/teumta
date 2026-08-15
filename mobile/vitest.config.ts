import path from 'node:path';
import { defineConfig } from 'vitest/config';

/** 순수 로직(utils) 테스트용 최소 설정. 화면 렌더링 테스트는 다루지 않는다. */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
