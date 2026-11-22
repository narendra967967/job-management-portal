import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site-url";
import { isRegistrationOpen } from "@/lib/plans";
import { publicAiInterviewsOpen } from "@/lib/mock-interviews/config";

export const dynamic = "force-dynamic";

// Public, indexable pages only. Sign-up is listed while registration is open,
// AI mock interviews while admin has them switched to Open.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [signup, aiInterviews] = await Promise.all([isRegistrationOpen().catch(() => false), publicAiInterviewsOpen()]);
  const now = new Date();
  return [
    { url: absoluteUrl("/"), lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/pricing"), lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    ...(aiInterviews ? [{ url: absoluteUrl("/ai-mock-interviews"), lastModified: now, changeFrequency: "weekly" as const, priority: 0.8 }] : []),
    ...(signup ? [{ url: absoluteUrl("/signup"), lastModified: now, changeFrequency: "monthly" as const, priority: 0.8 }] : []),
    { url: absoluteUrl("/login"), lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: absoluteUrl("/privacy"), lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: absoluteUrl("/terms"), lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: absoluteUrl("/refunds"), lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];
}
