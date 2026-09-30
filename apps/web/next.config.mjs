const apiProxyTarget = process.env.API_PROXY_TARGET || "http://localhost:4100";
const remoteApiProxyTarget = "https://finance-api.agentame.xyz";

async function resolveDevelopmentApiProxyTarget() {
  const localTarget = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(apiProxyTarget);
  if (process.env.NODE_ENV !== "development" || !localTarget) return apiProxyTarget;

  // Prefer the local API when it is running. If the developer only has the
  // web process up, route the local UI to the healthy Finance API instead of
  // leaving it on a dead localhost:4100 and surfacing "Failed to fetch".
  try {
    const health = await fetch(`${apiProxyTarget.replace(/\/+$/, "")}/health`, {
      signal: AbortSignal.timeout(800),
      cache: "no-store",
    });
    if (health.ok) return apiProxyTarget;
  } catch {
    // Continue to the remote API fallback below.
  }

  return remoteApiProxyTarget;
}

/** @type {import("next").NextConfig} */
const nextConfig = {
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
