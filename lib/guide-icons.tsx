// Guide topic icon key → Lucide icon. Shared by the admin icon picker and the
// user /guides menu (keys are stored on guide_topics.icon).

import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BookOpen,
  BriefcaseBusiness,
  Calendar,
  Crown,
  FileText,
  Gauge,
  LifeBuoy,
  Lightbulb,
  Mail,
  NotebookPen,
  Rocket,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  User,
  Wallet,
} from "lucide-react";
import type { GuideIconKey } from "@/lib/guides-model";

export const GUIDE_ICONS: Record<GuideIconKey, LucideIcon> = {
  rocket: Rocket,
  sparkles: Sparkles,
  mail: Mail,
  briefcase: BriefcaseBusiness,
  send: Send,
  bell: Bell,
  "file-text": FileText,
  crown: Crown,
  settings: Settings,
  user: User,
  shield: ShieldCheck,
  "book-open": BookOpen,
  lightbulb: Lightbulb,
  "life-buoy": LifeBuoy,
  calendar: Calendar,
  gauge: Gauge,
  wallet: Wallet,
  notebook: NotebookPen,
};

/** Icon for a stored key (unknown keys fall back to a book). */
export function guideIcon(key: string): LucideIcon {
  return GUIDE_ICONS[key as GuideIconKey] ?? BookOpen;
}
