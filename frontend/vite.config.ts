import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The backend only allows CORS from :5173 (app.cors.allowed-origins). Without
  // strictPort, a second dev server silently falls back to :5174 and every API
  // call dies on a 403 preflight instead of failing loudly here.
  server: {
    port: 5176,
    strictPort: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // SpreadJS là thư viện đóng gói sẵn: lõi ~6 MB, Designer + add-on ~15 MB. Hai chunk
    // dưới đây vượt ngưỡng cảnh báo mặc định (500 kB) là bình thường — chúng chỉ tải
    // khi màn có bảng tính mở (React.lazy trong shared/components/spreadsheet/lazy.tsx).
    chunkSizeWarningLimit: 16000,
    rollupOptions: {
      output: {
        // Tách SpreadJS khỏi chunk của màn hình: màn nhập/xem chỉ kéo "spreadjs",
        // màn thiết kế mẫu kéo thêm "spreadjs-designer". Chỉ gói @mescius vào đây —
        // chúng chỉ được import từ module nạp động nên không làm nặng trang đầu.
        manualChunks(id) {
          const normalized = id.replace(/\\/g, "/");
          // Monaco (ô soạn quy tắc) cố ý KHÔNG có nhóm riêng ở đây: nó chỉ được nạp động
          // từ shared/components/spreadsheet/script-editor/, Rollup tự tách chunk. Đặt tên
          // nhóm cho nó thì Rollup dồn cả helper dùng chung (react, __vitePreload) vào
          // chunk Monaco và trang đầu phải tải luôn 3 MB Monaco.
          if (!normalized.includes("/node_modules/@mescius/")) return undefined;
          if (
            /\/@mescius\/spread-sheets-(designer|print|shapes|datacharts-addon|slicers|pivot-addon|tablesheet|ganttsheet|reportsheet-addon|formula-panel)/.test(
              normalized
            )
          ) {
            return "spreadjs-designer";
          }
          return "spreadjs";
        },
      },
    },
  },
});
