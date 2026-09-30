const path = require("node:path");
const { defineConfig, loadEnv } = require("vite");
const react = require("@vitejs/plugin-react");

const envDir = path.resolve(__dirname, "../..");

module.exports = defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, "");
  const apiProxyTarget = env.API_PROXY_TARGET || "http://localhost:4100";
  const apiBaseUrl = mode === "development"
    ? (env.NEXT_PUBLIC_API_BASE_URL || "/v1")
    : (env.VITE_API_BASE_URL || env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4100");

  return {
    envDir,
    plugins: [react()],
    define: {
      "process.env.NEXT_PUBLIC_API_BASE_URL": JSON.stringify(apiBaseUrl),
    },
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
      proxy: {
        "/v1": { target: apiProxyTarget, changeOrigin: true, secure: true },
        "/health": { target: apiProxyTarget, changeOrigin: true, secure: true },
        "/ready": { target: apiProxyTarget, changeOrigin: true, secure: true },
      },
    },
  };
});
