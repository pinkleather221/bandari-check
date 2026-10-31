import type { NextConfig } from "next";
import path from "node:path";
const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  outputFileTracingIncludes: { "/api/demo/[name]": ["./data/samples/**/*"] },
  serverExternalPackages: ["@libsql/client"],
  experimental: { serverActions: { bodySizeLimit: "1mb" } },
};
export default config;
