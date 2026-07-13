import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../web"),
      "next/navigation": path.resolve(__dirname, "src/next-navigation-shim.ts"),
      "next/link": path.resolve(__dirname, "src/next-link-shim.tsx"),
    },
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname, "..")],
    },
  },
});
