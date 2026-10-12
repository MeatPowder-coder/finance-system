import path from "node:path";
import { fileURLToPath } from "node:url";

const apiProxyTarget = process.env.API_PROXY_TARGET || "http://localhost:4100";
const webAppRoot = path.dirname(fileURLToPath(import.meta.url));

async function resolveDevelopmentApiProxyTarget() {
  // Keep localhost app development on its configured backend. A remote API
  // must be selected explicitly with API_PROXY_TARGET; otherwise local data
  // and OAuth state can silently split across origins.
  return apiProxyTarget;
}

/** @type {import("next").NextConfig} */
const nextConfig = {
  webpack(config) {
    // Keep the web package's @/ imports anchored to this app when Next is
    // invoked through a workspace script from the monorepo root.
    config.resolve.alias["@"] = webAppRoot;
    return config;
  },
  async rewrites() {
    const resolvedApiProxyTarget = await resolveDevelopmentApiProxyTarget();
    return [
      {
        source: "/v1/:path*",
        destination: `${resolvedApiProxyTarget}/v1/:path*`,
      },
      {
        source: "/health",
        destination: `${resolvedApiProxyTarget}/health`,
      },
      {
        source: "/ready",
        destination: `${resolvedApiProxyTarget}/ready`,
      },
    ];
  },
};

export default nextConfig;
