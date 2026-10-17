import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// The Express API will live here once it exists. Nothing listens on it yet, so
// the app runs against the local mocks in `app/lib/mock-store.ts` by default.
const API_TARGET = process.env.API_TARGET ?? "http://127.0.0.1:4000";

export default defineConfig({
  plugins: [tailwindcss(), tsconfigPaths(), reactRouter()],
  server: {
    port: Number(process.env.PORT ?? 5173),
    strictPort: true,
    proxy: {
      "/qvac": { target: process.env.QVAC_API_TARGET ?? "http://127.0.0.1:4000", changeOrigin: true },
      "/api": { target: API_TARGET, changeOrigin: true },
    },
  },
});
