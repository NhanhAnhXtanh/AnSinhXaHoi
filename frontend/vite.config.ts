import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig, loadEnv, type PluginOption } from "vite";

// `ANALYZE=1 npm run build` ghi dist/stats.html (treemap kích thước raw/gzip từng module).
const analyze = process.env.ANALYZE === "1";

// frontend/.env (xem .env.example): FRONTEND_PORT, FRONTEND_HOST cho dev; VITE_* cho mã trình duyệt.
const envDir = __dirname;

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, "");
  const port = Number(env.FRONTEND_PORT || 8765);
  return {
    envDir,
    plugins: [
      react(),
      tailwindcss(),
      analyze &&
        (visualizer({
          filename: "dist/stats.html",
          template: "treemap",
          gzipSize: true,
        }) as PluginOption),
    ],
    // strictPort: cổng bận thì báo lỗi, không lặng lẽ sang cổng khác (backend chỉ nhận CORS đúng cổng).
    server: {
      port,
      strictPort: true,
      host: env.FRONTEND_HOST === "all" ? true : undefined,
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      // SpreadJS là thư viện đóng gói sẵn: lõi + IO ~7 MB, Designer + add-on ~21 MB. Hai chunk
      // dưới đây vượt ngưỡng cảnh báo mặc định (500 kB) là bình thường — chúng chỉ tải
      // khi màn có bảng tính mở (React.lazy trong shared/components/spreadsheet/lazy.tsx).
      chunkSizeWarningLimit: 22000,
      // Trên CI bỏ tính cỡ gzip từng chunk khi in bảng kết quả (chunk SpreadJS hàng chục MB, nén
      // lại chỉ để in log). `npm run verify:bundle` tự đo gzip trang đầu; ANALYZE=1 cho treemap.
      reportCompressedSize: !process.env.CI,
      rollupOptions: {
        output: {
          // Tách SpreadJS khỏi chunk của màn hình: màn nhập/xem chỉ kéo "spreadjs",
          // màn thiết kế mẫu kéo thêm "spreadjs-designer". Chỉ gói @mescius vào đây —
          // chúng chỉ được import từ module nạp động nên không làm nặng trang đầu.
          manualChunks(id) {
            const normalized = id.replace(/\\/g, "/");
            // React + helper CommonJS của Rollup PHẢI có nhóm riêng: cả trang đầu lẫn
            // @mescius/spread-sheets-react đều dùng chúng, và Rollup kéo phụ thuộc chung của
            // một nhóm manualChunks VÀO nhóm đó — để mặc định thì React rơi vào chunk
            // "spreadjs-designer" và index.html phải modulepreload cả 28 MB SpreadJS.
            if (
              // "\0commonjsHelpers.js", "\0commonjs-dynamic-modules"… (proxy từng module
              // mang đường dẫn + "?commonjs-…" nên không khớp và ở lại với module của nó).
              /^\0commonjs[^?]*$/.test(normalized) ||
              /\/node_modules\/(react|react-dom|scheduler)\//.test(normalized)
            ) {
              return "vendor-react";
            }
            // Monaco (ô soạn quy tắc) cố ý KHÔNG có nhóm riêng ở đây: nó chỉ được nạp động
            // từ shared/components/spreadsheet/script-editor/, Rollup tự tách chunk. Đặt tên
            // nhóm cho nó thì Rollup dồn cả helper dùng chung (react, __vitePreload) vào
            // chunk Monaco và trang đầu phải tải luôn 3 MB Monaco.
            if (!normalized.includes("/node_modules/@mescius/")) return undefined;
            // "spreadjs" = đúng những gì màn nhập/xem/duyệt/tổng hợp import (lõi + plugin IO,
            // xem impl/spread-workbook.tsx). Mọi gói @mescius khác — kể cả charts, gói mà
            // datacharts-addon kéo vào — chỉ màn thiết kế dùng, nên về "spreadjs-designer".
            // Liệt kê theo kiểu "danh sách đen" trước đây để charts lọt vào "spreadjs" trong
            // khi nó import shapes ở "spreadjs-designer": hai chunk vòng tròn và màn nhập
            // liệu kéo theo cả 15 MB Designer.
            if (/\/node_modules\/@mescius\/spread-sheets(-io)?\//.test(normalized)) {
              return "spreadjs";
            }
            return "spreadjs-designer";
          },
        },
      },
    },
  };
});
