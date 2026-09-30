const path = require("node:path");
const { defineConfig, loadEnv } = require("vite");
const react = require("@vitejs/plugin-react");

const envDir = path.resolve(__dirname, "../..");

module.exports = defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, envDir, "");
  const desktopEnv = loadEnv(mode, __dirname, "VITE_");
  const apiProxyTarget = env.API_PROXY_TARGET || "http://localhost:4100";
  const remoteApiProxyTarget = "https://finance-api.agentame.xyz";
  const localPreview = mode === "local-preview";
  let developmentApiProxyTarget = apiProxyTarget;
  let localDevelopmentApiAvailable = false;

  if (mode === "development" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(apiProxyTarget)) {
    try {
      const health = await fetch(`${apiProxyTarget.replace(/\/+$/, "")}/health`, {
        signal: AbortSignal.timeout(800),
        cache: "no-store",
      });
      localDevelopmentApiAvailable = health.ok;
      if (!localDevelopmentApiAvailable) developmentApiProxyTarget = remoteApiProxyTarget;
    } catch {
      // The local API is optional for frontend development. Fall back to the
      // browser-accessible Finance service when localhost:4100 is not running.
      developmentApiProxyTarget = remoteApiProxyTarget;
    }
  }
  const apiBaseUrl = localPreview
    // The preview is a browser client. Call the configured API directly so
    // Vite's Node proxy is not a second network dependency (CORS explicitly
    // allows localhost/127.0.0.1 preview origins on the Finance API).
    ? (env.FINANCE_LOCAL_PREVIEW_API_URL || env.VITE_API_BASE_URL || desktopEnv.VITE_API_BASE_URL || (env.NEXT_PUBLIC_API_BASE_URL?.startsWith("/") ? "" : env.NEXT_PUBLIC_API_BASE_URL) || apiProxyTarget)
    : mode === "development"
    ? (localDevelopmentApiAvailable ? (env.NEXT_PUBLIC_API_BASE_URL || "/v1") : remoteApiProxyTarget)
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
      proxy: makeApiProxy(mode === "development" ? developmentApiProxyTarget : apiProxyTarget),
    },
  };
});
