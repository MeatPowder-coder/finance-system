const apiProxyTarget = process.env.API_PROXY_TARGET || "http://localhost:4100";

/** @type {import("next").NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/v1/:path*",
        destination: `${apiProxyTarget}/v1/:path*`,
      },
      {
        source: "/health",
        destination: `${apiProxyTarget}/health`,
      },
      {
        source: "/ready",
        destination: `${apiProxyTarget}/ready`,
      },
    ];
  },
};

export default nextConfig;
