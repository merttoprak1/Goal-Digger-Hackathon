import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const API_TARGET = process.env.API_TARGET ?? "http://127.0.0.1:4002";

export default defineConfig({
  plugins: [tailwindcss(), tsconfigPaths(), reactRouter()],
  server: {
    port: Number(process.env.PORT ?? 5173),
    strictPort: true,
    proxy: {
      "/qvac": { target: process.env.QVAC_API_TARGET ?? "http://127.0.0.1:4002", changeOrigin: true },
      "/api": { target: API_TARGET, changeOrigin: true },
    },
  },
});
