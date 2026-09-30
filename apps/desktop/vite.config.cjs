const path = require("node:path");
const { defineConfig, loadEnv } = require("vite");
const react = require("@vitejs/plugin-react");

const envDir = path.resolve(__dirname, "../..");

module.exports = defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, "");
  const apiProxyTarget = env.API_PROXY_TARGET || "http://localhost:4100";
  const localPreview = mode === "local-preview";
  const apiBaseUrl = localPreview
    // The preview is a browser client. Call the configured API directly so
    // Vite's Node proxy is not a second network dependency (CORS explicitly
    // allows localhost/127.0.0.1 preview origins on the Finance API).
    ? (env.FINANCE_LOCAL_PREVIEW_API_URL || env.VITE_API_BASE_URL || env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4100")
    : mode === "development"
    ? (env.NEXT_PUBLIC_API_BASE_URL || "/v1")
    : (env.VITE_API_BASE_URL || env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4100");
  const makeApiProxy = (target) => ({
    "/v1": { target, changeOrigin: true, secure: true },
    "/health": { target, changeOrigin: true, secure: true },
    "/ready": { target, changeOrigin: true, secure: true },
  });

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
      proxy: makeApiProxy(apiProxyTarget),
    },
  };
});
