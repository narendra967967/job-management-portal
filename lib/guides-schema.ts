import "server-only";

// Zod schema for saving a How-to guide from the admin panel. The HTML body is
// size-capped here and sanitized separately (lib/guide-html.ts) before it's
// stored — that's what makes admin-pasted HTML safe to show users.

import { z } from "zod";
import { GUIDE_ICON_KEYS } from "@/lib/guides-model";

export const GUIDE_HTML_MAX = 300_000;

export const guideTopicSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2, "URL id is required.")
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "URL id: lowercase letters, numbers and single hyphens."),
  title: z.string().trim().min(1, "Title is required.").max(80, "Title is too long."),
  summary: z.string().trim().max(200, "Summary is too long."),
  icon: z.enum(GUIDE_ICON_KEYS, { message: "Pick an icon." }),
  status: z.enum(["active", "inactive"]),
  inProgress: z.boolean(),
  contentHtml: z.string().max(GUIDE_HTML_MAX, "The content is too large."),
});

export type GuideTopicInput = z.infer<typeof guideTopicSchema>;
