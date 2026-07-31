import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, "");
  const apiTarget = env.VITE_API_URL || "http://localhost:3000";

  return {
    // Single monorepo `.env` at repo root (VITE_*)
    envDir: repoRoot,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      // Locked — web uses 5174. Keep strict so a busy port fails loudly.
      port: 5173,
      strictPort: true,
      // Browser `/api/...` → Nest `/staff/...` (audience prefix stays off the wire).
      // Phase 1 iCal export: `/public/ical/...` → Nest `/public/ical/...` (OTA poll; no session).
      // Do not proxy `/health` through this origin.
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api/, "/staff"),
        },
        "/public/ical": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: "node",
      include: ["src/**/*.spec.ts"],
    },
  };
});
