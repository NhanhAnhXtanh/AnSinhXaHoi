import { defineConfig, devices } from "@playwright/test";

/**
 * E2E 4 luồng chính ASXH (ASX-159..162). Xem e2e/README.md để dựng môi trường.
 *
 * - Frontend: bản build `vite build` với VITE_API_URL trỏ backend e2e và VITE_E2E_HOOKS=1,
 *   phục vụ bằng `vite preview` ở E2E_PORT (mặc định 4180). `webServer` dưới đây tự bật
 *   preview nếu cổng chưa có ai nghe — nó KHÔNG build, build trước.
 * - Backend: chạy riêng (cổng E2E_API_URL, mặc định http://localhost:8090/api) trên CSDL
 *   thử (E2E_DATABASE_URL) — không bao giờ trên CSDL thật.
 *
 * Một worker, chạy tuần tự: máy dev ít RAM, và mỗi spec giữ riêng một năm báo cáo nên
 * không cần song song để độc lập.
 */
const port = Number(process.env.E2E_PORT ?? 4180);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 180_000,
  expect: { timeout: 20_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  outputDir: "test-results",
  use: {
    baseURL,
    headless: true,
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
    viewport: { width: 1600, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1600, height: 900 } } }],
  webServer: {
    command: `npx vite preview --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
