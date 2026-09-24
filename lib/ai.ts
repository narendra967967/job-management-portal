import "server-only";

// AI provider client. Reads the acting user's provider/model/key from
// user_settings (the key is decrypted from ciphertext, per-user), then calls the
// provider's REST API directly (no SDK dependency; supports OpenAI + Anthropic).
// Server-only — the key never reaches the client.

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userSettings as settingsT } from "@/db/schema";
import { decryptSecret } from "@/lib/crypto";
import { AI_PROVIDER_DEFAULT_MODEL, type AiProvider } from "@/lib/types";

/** Thrown when the user hasn't configured an AI key in Settings. */
export const AI_NOT_CONFIGURED = "AI_NOT_CONFIGURED";

interface UserAi {
  provider: AiProvider;
  model: string;
  key: string;
}

async function getUserAi(userId: string): Promise<UserAi> {
  const [s] = await db
    .select({
      provider: settingsT.aiProvider,
      model: settingsT.aiModel,
      ciphertext: settingsT.aiKeyCiphertext,
    })
    .from(settingsT)
    .where(eq(settingsT.userId, userId));

  if (!s?.ciphertext) throw new Error(AI_NOT_CONFIGURED);
  const provider = s.provider ?? "openai";
  return {
    provider,
    model: s.model?.trim() || AI_PROVIDER_DEFAULT_MODEL[provider],
    key: decryptSecret(s.ciphertext),
  };
}

async function callOpenAI(
  ai: UserAi,
  system: string,
  user: string,
  maxTokens: number,
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ai.key}`,
    },
    body: JSON.stringify({
      model: ai.model,
      temperature: 0.4,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json();
  return (data.choices?.[0]?.message?.content ?? "").trim();
}

// OpenRouter is OpenAI-compatible; same request/response shape, different base
// URL + Bearer key. The Referer/Title headers are optional attribution only.
async function callOpenRouter(
  ai: UserAi,
  system: string,
  user: string,
  maxTokens: number,
): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ai.key}`,
      "HTTP-Referer": "https://github.com/job-management-portal",
      "X-Title": "Job Management Portal",
    },
    body: JSON.stringify({
      model: ai.model,
      temperature: 0.4,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(
      `OpenRouter error ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  }
  const data = await res.json();
  return (data.choices?.[0]?.message?.content ?? "").trim();
}

async function callAnthropic(
  ai: UserAi,
  system: string,
  user: string,
  maxTokens: number,
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ai.key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ai.model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Anthropic error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json();
  return (data.content?.[0]?.text ?? "").trim();
}

/** Run one system+user prompt against the user's configured provider. */
export async function aiComplete(
  userId: string,
  system: string,
  user: string,
  maxTokens = 600,
): Promise<string> {
  const ai = await getUserAi(userId);
  switch (ai.provider) {
    case "anthropic":
      return callAnthropic(ai, system, user, maxTokens);
    case "openrouter":
      return callOpenRouter(ai, system, user, maxTokens);
    default:
      return callOpenAI(ai, system, user, maxTokens);
  }
}

/* ------------------------------------------------------------------ */
/* Vision — one text+image prompt (used by AI lead extraction)         */
/* ------------------------------------------------------------------ */

/** A base64-encoded image to send to a vision model. */
export interface VisionImage {
  /** Raw base64 (no `data:` prefix). */
  base64: string;
  /** e.g. "image/png", "image/jpeg", "image/webp". */
  mimeType: string;
}

async function callOpenAIVision(
  ai: UserAi,
  base: string,
  system: string,
  userText: string,
  image: VisionImage,
  maxTokens: number,
): Promise<string> {
  const res = await fetch(base, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ai.key}`,
      ...(base.includes("openrouter")
        ? {
            "HTTP-Referer": "https://github.com/job-management-portal",
            "X-Title": "Job Management Portal",
          }
        : {}),
    },
    body: JSON.stringify({
      model: ai.model,
      temperature: 0.2,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            {
              type: "image_url",
              image_url: {
                url: `data:${image.mimeType};base64,${image.base64}`,
              },
            },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`AI error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json();
  return (data.choices?.[0]?.message?.content ?? "").trim();
}

async function callAnthropicVision(
  ai: UserAi,
  system: string,
  userText: string,
  image: VisionImage,
  maxTokens: number,
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ai.key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ai.model,
      max_tokens: maxTokens,
      system,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: image.mimeType,
                data: image.base64,
              },
            },
            { type: "text", text: userText },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`Anthropic error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json();
  return (data.content?.[0]?.text ?? "").trim();
}

/**
 * Run one system + (text + image) prompt against the user's provider. Requires
 * the configured model to be vision-capable (e.g. gpt-4o/-mini, Claude 5, or a
 * vision model on OpenRouter); a non-vision model surfaces the provider's error.
 */
export async function aiCompleteVision(
  userId: string,
  system: string,
  userText: string,
  image: VisionImage,
  maxTokens = 800,
): Promise<string> {
  const ai = await getUserAi(userId);
  switch (ai.provider) {
    case "anthropic":
      return callAnthropicVision(ai, system, userText, image, maxTokens);
    case "openrouter":
      return callOpenAIVision(
        ai,
        "https://openrouter.ai/api/v1/chat/completions",
        system,
        userText,
        image,
        maxTokens,
      );
    default:
      return callOpenAIVision(
        ai,
        "https://api.openai.com/v1/chat/completions",
        system,
        userText,
        image,
        maxTokens,
      );
  }
}
