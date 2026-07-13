import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  envDir: path.resolve(process.cwd(), "../.."),
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "../web"),
      "next/navigation": path.resolve(process.cwd(), "src/next-navigation-shim.ts"),
      "next/link": path.resolve(process.cwd(), "src/next-link-shim.tsx"),
    },
  },
  server: {
    fs: {
      allow: [path.resolve(process.cwd(), "..")],
    },
  },
});
