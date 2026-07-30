import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // 순수 함수 단위 테스트만 실행하지만, config/env가 모듈 로드 시점에 DATABASE_URL을
    // 요구하므로(미설정 시 process.exit) 테스트용 더미 값을 주입한다. 실제 DB 연결은 하지 않는다.
    env: {
      DATABASE_URL: 'mysql://test:test@localhost:3306/teumta_test',
    },
  },
});
