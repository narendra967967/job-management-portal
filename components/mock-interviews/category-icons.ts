// One icon per kind of interview, shared by the booking form and the public
// AI mock interviews page. No "use client": a server page reads the map itself.

import {
  BookOpenCheck,
  Briefcase,
  ChartColumn,
  CodeXml,
  Cpu,
  Crown,
  HandCoins,
  Headset,
  HeartHandshake,
  Kanban,
  MessagesSquare,
  Network,
  Package,
  PhoneCall,
  Presentation,
  Puzzle,
  TrendingUp,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";

// Admin can add kinds of interview; those without an icon here get a speech bubble.
// Kinds no longer in the default list stay here so older bookings keep their icon.
export const CATEGORY_ICON: Partial<Record<string, LucideIcon>> = {
  "HR interview": Users,
  "Recruiter screen": PhoneCall,
  "Behavioral interview": HeartHandshake,
  "Managerial interview": Briefcase,
  "Technical concepts": Cpu,
  "Product management": Package,
  "Project management": Kanban,
  Leadership: Crown,
  "Stakeholder and client communication": Presentation,
  "Sales and account management": TrendingUp,
  "Customer success and support": Headset,
  "Guesstimates and problem-solving": Puzzle,
  "Salary and offer discussion": HandCoins,
  "Final round": Trophy,
  // Earlier kinds
  "Technical interview": Cpu,
  "System design": Network,
  Coding: CodeXml,
  "Data analytics": ChartColumn,
  "Case study": BookOpenCheck,
};

export const categoryIcon = (c: string): LucideIcon => CATEGORY_ICON[c] ?? MessagesSquare;
