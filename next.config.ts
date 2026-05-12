import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const backendOrigin = process.env.PV_BACKEND_ORIGIN ?? "https://pv-backend-7aff.onrender.com";
const projectRoot = fileURLToPath(new URL(".", import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
  httpAgentOptions: {
    keepAlive: false,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendOrigin}/:path*`,
      },
    ];
  },
};

export default nextConfig;
