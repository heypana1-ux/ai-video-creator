import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @remotion/renderer and @remotion/bundler are heavy, node-only packages with
  // native binaries. They must never be traced into the client bundle.
  serverExternalPackages: [
    "@remotion/bundler",
    "@remotion/renderer",
    "esbuild",
  ],
};

export default nextConfig;
