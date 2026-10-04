import "server-only";

// Site-wide branding reads (app name + whether custom logo/favicon exist, with a
// version for cache-busting). Used by the root layout's metadata and the admin
// Settings previews. Writes live in actions/admin-settings.ts.

import { cache } from "react";
import { db } from "@/lib/db";
import { appSettings, appAssets } from "@/db/schema";

export const DEFAULT_APP_NAME = "Job Management Portal";

/** The configured app name (falls back to the default). */
export const getAppName = cache(async (): Promise<string> => {
  const [s] = await db.select({ appName: appSettings.appName }).from(appSettings).limit(1);
  return s?.appName?.trim() || DEFAULT_APP_NAME;
});

export interface BrandingState {
  hasLogo: boolean;
  logoVersion: number;
  hasFavicon: boolean;
  faviconVersion: number;
}

/** Presence + version (updatedAt epoch ms) of each custom branding asset. */
export const getBranding = cache(async (): Promise<BrandingState> => {
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
});
