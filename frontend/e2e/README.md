# E2E — 4 luồng chính ASXH (Playwright)

| Spec | Luồng | Linear |
|---|---|---|
| `01-thiet-lap-mo-dot` | Sở thiết lập kỳ trên ma trận → lưu → mở đợt; đơn vị thấy phiếu | ASX-159 |
| `02-don-vi-nhap-nop` | Đơn vị nhập biểu 1a → lưu → kiểm tra & hoàn tất → đính kèm Kho bạc → nộp | ASX-160 |
| `03-so-duyet-tong-hop` | Sở duyệt một phiếu, trả lại một phiếu → sổ cái → màn Tổng hợp chỉ cộng phiếu đã duyệt | ASX-161 |
| `04-bao-cao-nam-ubnd` | Sở nộp báo cáo năm → UBND trả lại → Sở gửi lại Phiếu 2 → UBND duyệt; năm bị khoá | ASX-162 |

Phần được kiểm luôn đi qua giao diện; dữ liệu mà spec cần nhưng không kiểm (lịch năm, phiếu đã
nộp, kỳ đã chốt…) dựng qua REST (`support/api.ts`). Mỗi spec giữ riêng một năm (`support/years.ts`,
2041–2044) và xoá sạch năm đó trước và sau khi chạy (`support/db.ts`), nên chạy lẻ, chạy lại,
đổi thứ tự đều được. `support/db.ts` từ chối chạy trên CSDL tên `asxh-react-dn` / `report-stc*`.

## Chạy cục bộ

1. Backend riêng cho e2e (cổng 8090, CSDL thử `dth-framework`), từ `backend/`:

   ```bash
   ./gradlew --no-daemon bootJar
   SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/dth-framework \
   SPRING_DATASOURCE_PASSWORD=123456 SERVER_PORT=8090 \
   SPRING_APPLICATION_JSON='{"app.cors.allowed-origins":"http://localhost:4180","asxh.period-status-job.run-on-startup":false}' \
   java -jar build/libs/dth-framework-0.0.1-SNAPSHOT.jar
   ```

2. Frontend build có móc e2e (`VITE_E2E_HOOKS=1` để test gõ ô SpreadJS qua `window.__asxhE2E`;
   bản production không có móc này), từ `frontend/`:

   ```bash
   VITE_API_URL=http://localhost:8090/api VITE_E2E_HOOKS=1 npx vite build
   npx playwright install chromium   # lần đầu
   npx vite preview --port 4180 --strictPort   # Windows: tự bật ở cửa sổ khác
   npm run e2e                       # Linux / CI: tự bật preview ở :4180 nếu chưa có
   ```

   Trên Windows `playwright.config.ts` không tự bật preview: Playwright không dừng được
   tiến trình vite con qua cmd.exe nên lượt chạy treo sau khi test xong.

Biến môi trường: `E2E_API_URL` (mặc định `http://localhost:8090/api`), `E2E_DATABASE_URL`
(mặc định `postgresql://postgres:123456@localhost:5432/dth-framework`), `E2E_PORT` (4180).
Báo cáo HTML ở `playwright-report/`, trace của test lỗi ở `test-results/`.
