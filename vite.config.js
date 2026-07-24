import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// During local development, /api/* calls are proxied to `vercel dev`
// (see README) so the same code works locally and once deployed.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});
