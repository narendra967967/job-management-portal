// One icon per kind of interview, shared by the booking form and the public
// AI mock interviews page. No "use client": a server page reads the map itself.

import {
  BookOpenCheck,
  Briefcase,
  ChartColumn,
  CodeXml,
  Cpu,
  Crown,
  HeartHandshake,
  Kanban,
  MessagesSquare,
  Network,
  Package,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";

// Admin can add kinds of interview; those without an icon here get a speech bubble.
export const CATEGORY_ICON: Partial<Record<string, LucideIcon>> = {
  "HR interview": Users,
  "Technical interview": Cpu,
  "Behavioral interview": HeartHandshake,
  "Managerial interview": Briefcase,
  "Product management": Package,
  "Project management": Kanban,
  "System design": Network,
  Coding: CodeXml,
  "Data analytics": ChartColumn,
  Leadership: Crown,
  "Case study": BookOpenCheck,
  "Final round": Trophy,
};

export const categoryIcon = (c: string): LucideIcon => CATEGORY_ICON[c] ?? MessagesSquare;
