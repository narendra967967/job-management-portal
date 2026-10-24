"use client";

// Google reCAPTCHA v3 in the browser: loads Google's script for the given site
// key and returns a token for an action at submit time. With no site key (the
// check is off) it loads nothing and tokens are "". The server decides whether
// a token is required — see lib/captcha.ts.

import { useCallback, useEffect } from "react";

/** Request header the server reads the token from (lib/captcha.ts CAPTCHA_HEADER). */
export const CAPTCHA_HEADER = "x-captcha-response";

interface Grecaptcha {
  ready(cb: () => void): void;
  execute(siteKey: string, opts: { action: string }): Promise<string>;
}
declare global {
  interface Window {
    grecaptcha?: Grecaptcha;
  }
}

const scripts = new Map<string, Promise<void>>();

function loadScript(siteKey: string): Promise<void> {
  let p = scripts.get(siteKey);
  if (!p) {
    p = new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        scripts.delete(siteKey);
        reject(new Error("reCAPTCHA failed to load"));
      };
      document.head.appendChild(s);
    });
    scripts.set(siteKey, p);
  }
  return p;
}

/** A token for `action`, or "" if the script couldn't load / run. */
export async function recaptchaToken(siteKey: string, action: string): Promise<string> {
  try {
    await loadScript(siteKey);
    const g = window.grecaptcha;
    if (!g) return "";
    await new Promise<void>((r) => g.ready(r));
    return await g.execute(siteKey, { action });
  } catch {
    return "";
  }
}

/** Preloads the script and returns getToken(action). */
export function useRecaptcha(siteKey: string | null | undefined) {
  useEffect(() => {
    if (siteKey) loadScript(siteKey).catch(() => {});
  }, [siteKey]);
  return useCallback(
    async (action: string): Promise<string> => (siteKey ? recaptchaToken(siteKey, action) : ""),
    [siteKey],
  );
}

/** fetchOptions for a Better Auth client call carrying the token. */
export function captchaFetchOptions(token: string) {
  return token ? { headers: { [CAPTCHA_HEADER]: token } } : undefined;
}
