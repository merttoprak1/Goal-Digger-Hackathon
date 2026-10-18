import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv, searchForWorkspaceRoot, type PluginOption } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import {
  assertPilotCommand,
  createPilotAccessMiddleware,
  pilotAccessConfig,
} from "./app/lib/pilot-access.ts";

const API_TARGET = process.env.API_TARGET ?? "http://127.0.0.1:4002";

export default defineConfig(({ command, mode }) => {
  const pilot = pilotAccessConfig({
    ...loadEnv(mode, process.cwd(), ""),
    ...process.env,
  });
  assertPilotCommand(command, pilot);
  const workspaceRoot = searchForWorkspaceRoot(process.cwd());
  const dependencyRoot = realpathSync(resolve(process.cwd(), "node_modules"));

  const plugins: PluginOption[] = [tailwindcss(), tsconfigPaths(), reactRouter()];
  if (pilot.enabled) {
    plugins.push({
      name: "closed-pilot-access",
      configureServer(server) {
        server.middlewares.use(createPilotAccessMiddleware(pilot));
      },
    });
  }

  return {
    plugins,
    server: {
      port: Number(process.env.PORT ?? 5173),
      strictPort: true,
      allowedHosts: [".tunnl.gg"],
      fs: { allow: [workspaceRoot, dependencyRoot] },
      proxy: {
        "/qvac": { target: process.env.QVAC_API_TARGET ?? "http://127.0.0.1:4000", changeOrigin: true },
        "/api": { target: API_TARGET, changeOrigin: true },
      },
    },
  };
});
