import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the résumé text extractors out of the bundle — they're Node-only and
  // used only inside Server Actions.
  serverExternalPackages: ["pdf-parse", "mammoth", "nodemailer"],
};

export default nextConfig;
