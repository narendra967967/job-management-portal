import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Video hosts a How-to guide may embed — keep in step with IFRAME_HOSTS in
// lib/guide-html.ts (the sanitizer only lets these iframes through).
const GUIDE_FRAME_HOSTS = [
  "https://www.youtube.com",
  "https://youtube.com",
  "https://www.youtube-nocookie.com",
  "https://player.vimeo.com",
  "https://www.loom.com",
];

// Content-Security-Policy. script-src still needs 'unsafe-inline' for Next.js's
// inline bootstrap scripts (a nonce-based CSP via middleware would remove it, at
// the cost of rendering every page dynamically). Everything else is locked to
// our own origin: no third-party scripts, no framing of our pages, no plugins.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:", // guide images may be any https URL
  "media-src 'self' https:", // guide <video>
  "font-src 'self' data:",
  "connect-src 'self'", // fetch + support-chat EventSource; AI/Gmail calls are server-side
  `frame-src ${GUIDE_FRAME_HOSTS.join(" ")}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
  // Production builds only: dev needs eval/websockets for hot reload, and HSTS
  // is meaningless on http://localhost. Preprod and prod are HTTPS-only.
  ...(isProd
    ? [
        { key: "Content-Security-Policy", value: CSP },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
      ]
    : []),
];

const nextConfig: NextConfig = {
  // Don't advertise the framework (X-Powered-By: Next.js).
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // Emit a self-contained server (.next/standalone/server.js) so the Docker
  // runtime image only needs Node + the traced deps — no full node_modules.
  output: "standalone",
  // Keep Node-only libraries out of the bundle: the résumé text extractors and
  // the email libraries. mailauth bundled spends ~1 minute on a DKIM check that
  // takes 0.4 s unbundled; mailparser goes with it.
  serverExternalPackages: ["mammoth", "nodemailer", "mailauth", "mailparser"],
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
