import { ImageResponse } from "next/og";
import { getAppName } from "@/lib/branding";

// Social share card for the public pages (link previews on LinkedIn, WhatsApp,
// X, Slack…). Brand gradient + the product line; app name from Branding.

export const alt = "Job application tracker with AI";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

export default async function OpengraphImage() {
  const appName = await getAppName().catch(() => "Jobtiva");
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(135deg, #4f46e5 0%, #6d28d9 55%, #9333ea 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>{appName}</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 72, fontWeight: 700, lineHeight: 1.08, letterSpacing: -2, maxWidth: 980 }}>
            Track every job application in one organized place
          </div>
          <div style={{ display: "flex", marginTop: 28, fontSize: 32, opacity: 0.85, maxWidth: 980 }}>
            Job alerts become leads. AI scores the fit, checks your résumé and helps you apply better.
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 26, opacity: 0.75 }}>Free trial · No auto-applying · Private by design</div>
      </div>
    ),
    size,
  );
}
