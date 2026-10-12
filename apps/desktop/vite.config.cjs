const path = require("node:path");
const { defineConfig, loadEnv } = require("vite");
const react = require("@vitejs/plugin-react");

const envDir = path.resolve(__dirname, "../..");

module.exports = defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, envDir, "");
  const apiProxyTarget = env.API_PROXY_TARGET || "http://localhost:4100";
  const localPreview = mode === "local-preview";
  // A local preview stays attached to the local API by default. Reaching a
  // remote finance account is explicit via FINANCE_LOCAL_PREVIEW_API_URL.
  let previewApiProxyTarget = env.FINANCE_LOCAL_PREVIEW_API_URL || apiProxyTarget;

  if (localPreview && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(apiProxyTarget)) {
    try {
      const health = await fetch(`${apiProxyTarget.replace(/\/+$/, "")}/health`, {
        signal: AbortSignal.timeout(1200),
        cache: "no-store",
      });
      if (health.ok) previewApiProxyTarget = apiProxyTarget;
    } catch {
      // Keep the local target so an offline backend is visible as offline.
    }
  }

  const apiBaseUrl = localPreview
    // Keep browser requests same-origin. The preview server proxies Finance API
    // routes, avoiding CORS failures from localhost preview ports.
    ? "/v1"
    : mode === "development"
    ? "/v1"
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
    preview: {
      proxy: makeApiProxy(localPreview ? previewApiProxyTarget : apiProxyTarget),
    },
  };
});
