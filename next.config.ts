import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits dist/standalone/server.js for the Cloud Run container.
  output: "standalone",
};

export default nextConfig;
