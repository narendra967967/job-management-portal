import "server-only";

// Zod schema for saving a How-to guide topic from the admin panel. Text is
// rendered by MarkdownLite (no raw HTML), so the risks are URLs: videos must be
// http(s), screenshots https or a /public path, buttons an in-app path or https.

import { z } from "zod";
import { GUIDE_ICON_KEYS, isAppPath, isHttpUrl } from "@/lib/guides-model";

const str = (max: number, msg?: string) => z.string().trim().max(max, msg);
const req = (label: string, max: number) =>
  z.string().trim().min(1, `${label} is required.`).max(max, `${label} is too long.`);

const block = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: req("Text", 8000) }),
  z.object({
    type: z.literal("steps"),
    steps: z
      .array(z.object({ title: req("Step title", 200), detail: str(1000).optional() }))
      .min(1, "Add at least one step.")
      .max(30),
  }),
  z.object({
    type: z.literal("callout"),
    tone: z.enum(["tip", "note", "warning"]),
    title: str(120).optional(),
    text: req("Box text", 2000),
  }),
  z.object({
    type: z.literal("video"),
    title: req("Video title", 160),
    // "" = "coming soon" placeholder.
    url: str(500).refine((v) => v === "" || isHttpUrl(v), "Video link must start with https://"),
    duration: str(20).optional(),
  }),
  z.object({
    type: z.literal("image"),
    src: req("Screenshot URL", 500).refine(
      (v) => isAppPath(v) || /^https:\/\//i.test(v),
      "Screenshot URL must start with https:// or /",
    ),
    alt: req("Screenshot description", 200),
    caption: str(300).optional(),
  }),
  z.object({
    type: z.literal("links"),
    links: z
      .array(
        z.object({
          label: req("Button label", 80),
          href: req("Button link", 500).refine(
            (v) => isAppPath(v) || isHttpUrl(v),
            "Button link must be an app path like /settings or an https:// URL",
          ),
        }),
      )
      .min(1, "Add at least one button.")
      .max(6),
  }),
]);

export const guideTopicSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2, "URL id is required.")
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "URL id: lowercase letters, numbers and single hyphens."),
  title: req("Title", 80),
  summary: str(200),
  icon: z.enum(GUIDE_ICON_KEYS, { message: "Pick an icon." }),
  group: req("Menu group", 40),
  status: z.enum(["active", "inactive"]),
  inProgress: z.boolean(),
  sections: z
    .array(
      z.object({
        heading: req("Section heading", 120),
        blocks: z.array(block).max(40),
      }),
    )
    .max(30),
});

export type GuideTopicInput = z.infer<typeof guideTopicSchema>;
