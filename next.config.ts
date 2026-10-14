import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server (.next/standalone/server.js) so the Docker
  // runtime image only needs Node + the traced deps — no full node_modules.
  output: "standalone",
  // Keep the résumé text extractors out of the bundle — they're Node-only and
  // used only inside Server Actions.
  serverExternalPackages: ["mammoth", "nodemailer", "@aws-sdk/client-s3"],
  experimental: {
    serverActions: {
      // Résumé uploads go through a Server Action (default cap: 1 MB). The app
      // allows files up to 5 MB (RESUME_MAX_BYTES); leave room for the
      // multipart overhead. Keep in step with Nginx's client_max_body_size (8m).
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
