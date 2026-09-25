import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server (.next/standalone/server.js) so the Docker
  // runtime image only needs Node + the traced deps — no full node_modules.
  output: "standalone",
  // Keep the résumé text extractors out of the bundle — they're Node-only and
  // used only inside Server Actions.
  serverExternalPackages: [
    "pdf-parse",
    "mammoth",
    "nodemailer",
    "@aws-sdk/client-s3",
  ],
};

export default nextConfig;
