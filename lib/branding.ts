import "server-only";

// Site-wide branding reads (app name + whether custom logo/favicon exist, with a
// version for cache-busting). Used by the root layout's metadata and the admin
// Settings previews. Writes live in actions/admin-settings.ts.

import { cache } from "react";
import { db } from "@/lib/db";
import { appSettings, appAssets } from "@/db/schema";

export const DEFAULT_APP_NAME = "Jobtiva";

/** The configured app name (falls back to the default). */
export const getAppName = cache(async (): Promise<string> => {
  try {
    const [s] = await db.select({ appName: appSettings.appName }).from(appSettings).limit(1);
    return s?.appName?.trim() || DEFAULT_APP_NAME;
  } catch {
    // DB unavailable (e.g. `next build` runs with no DATABASE_URL) — use the default
    // so metadata generation never fails the build. Real value is read at runtime.
    return DEFAULT_APP_NAME;
  }
});

export interface TaglineState {
  /** The tagline text (trimmed), or "" when none is set. */
  text: string;
  /** Whether the admin enabled showing it. */
  show: boolean;
}

/** The configured tagline + whether it should be shown. Use `show && text` to gate. */
export const getTagline = cache(async (): Promise<TaglineState> => {
  try {
    const [s] = await db
      .select({ tagline: appSettings.tagline, showTagline: appSettings.showTagline })
      .from(appSettings)
      .limit(1);
    return { text: s?.tagline?.trim() || "", show: !!s?.showTagline };
  } catch {
    // DB unavailable (e.g. during `next build`) — no tagline.
    return { text: "", show: false };
  }
});

/** The configured support email, or "" when none is set. */
export const getSupportEmail = cache(async (): Promise<string> => {
  try {
    const [s] = await db.select({ supportEmail: appSettings.supportEmail }).from(appSettings).limit(1);
    return s?.supportEmail?.trim() || "";
  } catch {
    return "";
  }
});

/** Whether public self-registration is enabled (admin Settings → General). */
export const getSignupAllowed = cache(async (): Promise<boolean> => {
  try {
    const [s] = await db.select({ allowSignup: appSettings.allowSignup }).from(appSettings).limit(1);
    return !!s?.allowSignup;
  } catch {
    // DB unavailable (e.g. during `next build`) — default closed.
    return false;
  }
});

/** Absolute base URL of the app (for links/assets in emails). */
export function getAppBaseUrl(): string {
  return (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

export interface BrandingState {
  hasLogo: boolean;
  logoVersion: number;
  hasFavicon: boolean;
  faviconVersion: number;
}

/** Presence + version (updatedAt epoch ms) of each custom branding asset. */
export const getBranding = cache(async (): Promise<BrandingState> => {
  try {
    const rows = await db
      .select({ kind: appAssets.kind, updatedAt: appAssets.updatedAt })
      .from(appAssets);
    const logo = rows.find((r) => r.kind === "logo");
    const favicon = rows.find((r) => r.kind === "favicon");
    return {
      hasLogo: !!logo,
      logoVersion: logo ? logo.updatedAt.getTime() : 0,
      hasFavicon: !!favicon,
      faviconVersion: favicon ? favicon.updatedAt.getTime() : 0,
    };
  } catch {
    // DB unavailable (e.g. during `next build`) — report no custom branding.
    return { hasLogo: false, logoVersion: 0, hasFavicon: false, faviconVersion: 0 };
  }
});
