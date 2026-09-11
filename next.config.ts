import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["ssh2"],
  experimental: {
    useTypeScriptCli: false,
  },
};

export default nextConfig;
