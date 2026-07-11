import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // 플레이라이트 E2E 테스트가 있는 tests/ 폴더를 단위 테스트 스캔 대상에서 제외합니다.
    exclude: ["node_modules", "dist", ".next", ".git", "tests"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
