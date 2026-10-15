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
});
