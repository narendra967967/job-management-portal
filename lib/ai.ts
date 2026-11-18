import "server-only";

// AI provider client. Reads the acting user's provider/model/key from
// user_settings (the key is decrypted from ciphertext, per-user), then calls the
// provider's REST API directly (no SDK dependency; supports OpenAI + Anthropic).
// Admin-side AI (the knowledge base agent) uses the admin key in app_ai_config
// instead, through adminAiComplete; users' features never touch it.
// Server-only — the key never reaches the client.

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { appAiConfig, mockInterviewConfig, userSettings as settingsT } from "@/db/schema";
import { decryptSecret } from "@/lib/crypto";
import { AI_PROVIDER_DEFAULT_MODEL, type AiProvider } from "@/lib/types";

/** Thrown when the user hasn't configured an AI key in Settings. */
export const AI_NOT_CONFIGURED = "AI_NOT_CONFIGURED";
/** Thrown when admin Settings → AI has no admin key. */
export const ADMIN_AI_NOT_CONFIGURED = "ADMIN_AI_NOT_CONFIGURED";

interface UserAi {
  provider: AiProvider;
  model: string;
  key: string;
}

/** Optional per-call settings (defaults keep the existing behaviour). */
export interface AiCallOptions {
  temperature?: number;
  /** Abort the provider request after this long. */
  timeoutMs?: number;
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

async function getAdminAi(): Promise<UserAi> {
  const [c] = await db
    .select({
      provider: appAiConfig.adminProvider,
      model: appAiConfig.adminModel,
      ciphertext: appAiConfig.adminKeyCiphertext,
    })
    .from(appAiConfig)
    .limit(1);

  if (!c?.ciphertext) throw new Error(ADMIN_AI_NOT_CONFIGURED);
  return {
    provider: c.provider,
    model: c.model?.trim() || AI_PROVIDER_DEFAULT_MODEL[c.provider],
    key: decryptSecret(c.ciphertext),
  };
}

async function callOpenAI(
  ai: UserAi,
  system: string,
  user: string,
  maxTokens: number,
  opts: AiCallOptions = {},
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ai.key}`,
    },
    body: JSON.stringify({
      model: ai.model,
      temperature: opts.temperature ?? 0.4,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: opts.timeoutMs ? AbortSignal.timeout(opts.timeoutMs) : undefined,
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
  opts: AiCallOptions = {},
): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ai.key}`,
      "HTTP-Referer": "https://github.com/job-management-portal",
      "X-Title": "Jobtiva",
    },
    body: JSON.stringify({
      model: ai.model,
      temperature: opts.temperature ?? 0.4,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: opts.timeoutMs ? AbortSignal.timeout(opts.timeoutMs) : undefined,
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
  opts: AiCallOptions = {},
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
      ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
      system,
      messages: [{ role: "user", content: user }],
    }),
    signal: opts.timeoutMs ? AbortSignal.timeout(opts.timeoutMs) : undefined,
  });
  if (!res.ok) {
    throw new Error(`Anthropic error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json();
  return (data.content?.[0]?.text ?? "").trim();
}

function complete(
  ai: UserAi,
  system: string,
  user: string,
  maxTokens: number,
  opts: AiCallOptions,
): Promise<string> {
  switch (ai.provider) {
    case "anthropic":
      return callAnthropic(ai, system, user, maxTokens, opts);
    case "openrouter":
      return callOpenRouter(ai, system, user, maxTokens, opts);
    default:
      return callOpenAI(ai, system, user, maxTokens, opts);
  }
}

/** Run one system+user prompt against the user's configured provider. */
export async function aiComplete(
  userId: string,
  system: string,
  user: string,
  maxTokens = 600,
  opts: AiCallOptions = {},
): Promise<string> {
  return complete(await getUserAi(userId), system, user, maxTokens, opts);
}

/** Run one system+user prompt on the admin key (admin Settings → AI). */
export async function adminAiComplete(
  system: string,
  user: string,
  maxTokens = 600,
  opts: AiCallOptions = {},
): Promise<string> {
  return complete(await getAdminAi(), system, user, maxTokens, opts);
}

/** Whether the user has saved an AI key (no decryption, no provider call). */
export async function userHasAiKey(userId: string): Promise<boolean> {
  const [s] = await db
    .select({ ciphertext: settingsT.aiKeyCiphertext })
    .from(settingsT)
    .where(eq(settingsT.userId, userId));
  return !!s?.ciphertext;
}

/* ------------------------------------------------------------------ */
/* Vision — one text prompt + image(s) (used by AI lead extraction)    */
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
  images: VisionImage[],
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
            "X-Title": "Jobtiva",
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
            // "high": read at full resolution — screenshots are mostly small text.
            ...images.map((image) => ({
              type: "image_url",
              image_url: {
                url: `data:${image.mimeType};base64,${image.base64}`,
                detail: "high",
              },
            })),
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
  images: VisionImage[],
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
            ...images.map((image) => ({
              type: "image",
              source: {
                type: "base64",
                media_type: image.mimeType,
                data: image.base64,
              },
            })),
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
 * Run one system + (text + images) prompt against the user's provider. Several
 * images are sent in order in one message (e.g. slices of a long screenshot).
 * Requires
 * the configured model to be vision-capable (e.g. gpt-4o/-mini, Claude 5, or a
 * vision model on OpenRouter); a non-vision model surfaces the provider's error.
 */
export async function aiCompleteVision(
  userId: string,
  system: string,
  userText: string,
  images: VisionImage[],
  maxTokens = 800,
): Promise<string> {
  const ai = await getUserAi(userId);
  switch (ai.provider) {
    case "anthropic":
      return callAnthropicVision(ai, system, userText, images, maxTokens);
    case "openrouter":
      return callOpenAIVision(
        ai,
        "https://openrouter.ai/api/v1/chat/completions",
        system,
        userText,
        images,
        maxTokens,
      );
    default:
      return callOpenAIVision(
        ai,
        "https://api.openai.com/v1/chat/completions",
        system,
        userText,
        images,
        maxTokens,
      );
  }
}

/* ------------------------------------------------------------------ */
/* Mock interviews — the module's own key (Admin → Mock interviews →    */
/* Module settings → AI service). Separate from users' keys and the     */
/* admin key, so its use and cost are counted on their own. Returns the */
/* tokens used with the text.                                          */
/* ------------------------------------------------------------------ */

/** Thrown when Module settings has no AI key. */
export const MODULE_AI_NOT_CONFIGURED = "MODULE_AI_NOT_CONFIGURED";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ModuleAiResult {
  text: string;
  /** All input tokens, cached ones included. */
  tokensIn: number;
  /** Input tokens the provider served from its cache (charged less). */
  tokensCached: number;
  tokensOut: number;
  provider: AiProvider;
  model: string;
}

export interface ModuleAiOptions extends AiCallOptions {
  /** Ask for a JSON object back (OpenAI and OpenRouter honor it; Anthropic is told in the prompt). */
  json?: boolean;
}

async function getModuleAi(): Promise<UserAi> {
  const [c] = await db
    .select({ provider: mockInterviewConfig.aiProvider, model: mockInterviewConfig.aiModel, ciphertext: mockInterviewConfig.aiKeyCiphertext })
    .from(mockInterviewConfig)
    .where(eq(mockInterviewConfig.id, "app"));
  if (!c?.ciphertext) throw new Error(MODULE_AI_NOT_CONFIGURED);
  return { provider: c.provider, model: c.model?.trim() || AI_PROVIDER_DEFAULT_MODEL[c.provider], key: decryptSecret(c.ciphertext) };
}

/**
 * OpenAI's newer reasoning models (gpt-5…, gpt-6…, o-series) take
 * max_completion_tokens, no temperature, and a reasoning effort. Interviews
 * run them with as little thinking as each allows, so replies stay quick.
 */
export function reasoningEffortFor(model: string): string | null {
  const m = model.replace(/^openai\//, "").toLowerCase();
  if (/^gpt-6/.test(m)) return "none";
  if (/^gpt-5/.test(m)) return "minimal";
  if (/^o\d/.test(m)) return "low";
  return null;
}

async function chatOpenAiLike(url: string, ai: UserAi, system: string, turns: ChatTurn[], maxTokens: number, opts: ModuleAiOptions): Promise<Omit<ModuleAiResult, "provider" | "model">> {
  const effort = reasoningEffortFor(ai.model);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ai.key}`,
      ...(url.includes("openrouter") ? { "HTTP-Referer": "https://github.com/job-management-portal", "X-Title": "Jobtiva" } : {}),
    },
    body: JSON.stringify({
      model: ai.model,
      ...(effort
        ? url.includes("openrouter")
          ? { max_tokens: maxTokens, reasoning: { effort } }
          : { max_completion_tokens: maxTokens, reasoning_effort: effort }
        : { temperature: opts.temperature ?? 0.4, max_tokens: maxTokens }),
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      messages: [{ role: "system", content: system }, ...turns],
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 60_000),
  });
  if (!res.ok) throw new Error(`AI error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return {
    text: (data.choices?.[0]?.message?.content ?? "").trim(),
    tokensIn: Number(data.usage?.prompt_tokens ?? 0),
    tokensCached: Number(data.usage?.prompt_tokens_details?.cached_tokens ?? 0),
    tokensOut: Number(data.usage?.completion_tokens ?? 0),
  };
}

async function chatAnthropic(ai: UserAi, system: string, turns: ChatTurn[], maxTokens: number, opts: ModuleAiOptions): Promise<Omit<ModuleAiResult, "provider" | "model">> {
  // Anthropic wants the conversation to start with the user.
  const messages = turns[0]?.role === "assistant" ? [{ role: "user" as const, content: "(The interview begins.)" }, ...turns] : turns;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": ai.key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: ai.model,
      max_tokens: maxTokens,
      ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
      system: opts.json ? `${system}\n\nReply with one JSON object only, no other text.` : system,
      messages,
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 60_000),
  });
  if (!res.ok) throw new Error(`Anthropic error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return {
    text: (data.content?.[0]?.text ?? "").trim(),
    // Anthropic reports cache reads separately from input_tokens.
    tokensIn: Number(data.usage?.input_tokens ?? 0) + Number(data.usage?.cache_read_input_tokens ?? 0),
    tokensCached: Number(data.usage?.cache_read_input_tokens ?? 0),
    tokensOut: Number(data.usage?.output_tokens ?? 0),
  };
}

/** One call on the Mock interviews module key: a system prompt and the conversation so far. */
export async function moduleAiChat(system: string, turns: ChatTurn[], maxTokens = 800, opts: ModuleAiOptions = {}): Promise<ModuleAiResult> {
  const ai = await getModuleAi();
  const r =
    ai.provider === "anthropic"
      ? await chatAnthropic(ai, system, turns, maxTokens, opts)
      : await chatOpenAiLike(
          ai.provider === "openrouter" ? "https://openrouter.ai/api/v1/chat/completions" : "https://api.openai.com/v1/chat/completions",
          ai,
          system,
          turns,
          maxTokens,
          opts,
        );
  return { ...r, provider: ai.provider, model: ai.model };
}

/** Module settings → Test connection: a tiny request with the saved key. */
export async function testModuleAi(): Promise<{ ok: true; model: string } | { ok: false; error: string }> {
  try {
    const r = await moduleAiChat("Reply with the single word OK.", [{ role: "user", content: "Ping" }], 5, { timeoutMs: 20_000, temperature: 0 });
    return { ok: true, model: r.model };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === MODULE_AI_NOT_CONFIGURED) return { ok: false, error: "Save an API key first." };
    return { ok: false, error: msg.replace(/sk-[A-Za-z0-9_-]+/g, "sk-…").slice(0, 200) };
  }
}
