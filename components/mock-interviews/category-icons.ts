// Icons for kinds of interview. Admin picks one per kind in Module settings →
// Interview rules (saved as a key in mock_interview_config.category_icons); the
// booking form, the public AI mock interviews page and the admin editor all
// draw it from here. No "use client": server pages read these maps directly,
// and the save action checks keys against KIND_ICON_KEYS.

import {
  Award,
  BadgeCheck,
  BookOpenCheck,
  Brain,
  Briefcase,
  Building2,
  Calculator,
  ChartColumn,
  ChartLine,
  ClipboardList,
  CodeXml,
  Compass,
  Cpu,
  Crown,
  Flag,
  GraduationCap,
  Handshake,
  HandCoins,
  Headset,
  HeartHandshake,
  Kanban,
  Landmark,
  Lightbulb,
  Megaphone,
  MessageCircle,
  MessagesSquare,
  Mic,
  Network,
  Package,
  Palette,
  PhoneCall,
  Presentation,
  Puzzle,
  Rocket,
  Scale,
  Search,
  ShieldCheck,
  Stethoscope,
  Target,
  TrendingUp,
  Trophy,
  UserRoundCheck,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/** Every icon an admin can choose, in the order the picker shows them. */
export const KIND_ICONS = {
  users: { icon: Users, label: "People" },
  phone: { icon: PhoneCall, label: "Phone call" },
  "heart-handshake": { icon: HeartHandshake, label: "Rapport" },
  briefcase: { icon: Briefcase, label: "Briefcase" },
  cpu: { icon: Cpu, label: "Technology" },
  package: { icon: Package, label: "Product" },
  kanban: { icon: Kanban, label: "Board" },
  crown: { icon: Crown, label: "Leadership" },
  presentation: { icon: Presentation, label: "Slides" },
  "trending-up": { icon: TrendingUp, label: "Growth" },
  headset: { icon: Headset, label: "Support" },
  puzzle: { icon: Puzzle, label: "Puzzle" },
  "hand-coins": { icon: HandCoins, label: "Money" },
  trophy: { icon: Trophy, label: "Final" },
  messages: { icon: MessagesSquare, label: "Talk" },
  "message-circle": { icon: MessageCircle, label: "Chat" },
  mic: { icon: Mic, label: "Mic" },
  handshake: { icon: Handshake, label: "Handshake" },
  "user-check": { icon: UserRoundCheck, label: "Hiring" },
  "graduation-cap": { icon: GraduationCap, label: "Graduate" },
  brain: { icon: Brain, label: "Thinking" },
  lightbulb: { icon: Lightbulb, label: "Idea" },
  target: { icon: Target, label: "Target" },
  compass: { icon: Compass, label: "Strategy" },
  rocket: { icon: Rocket, label: "Launch" },
  flag: { icon: Flag, label: "Goal" },
  award: { icon: Award, label: "Award" },
  "badge-check": { icon: BadgeCheck, label: "Verified" },
  megaphone: { icon: Megaphone, label: "Marketing" },
  "chart-line": { icon: ChartLine, label: "Trend" },
  "chart-column": { icon: ChartColumn, label: "Analytics" },
  calculator: { icon: Calculator, label: "Numbers" },
  landmark: { icon: Landmark, label: "Finance" },
  scale: { icon: Scale, label: "Legal" },
  "shield-check": { icon: ShieldCheck, label: "Security" },
  stethoscope: { icon: Stethoscope, label: "Healthcare" },
  building: { icon: Building2, label: "Company" },
  palette: { icon: Palette, label: "Design" },
  wrench: { icon: Wrench, label: "Operations" },
  search: { icon: Search, label: "Research" },
  clipboard: { icon: ClipboardList, label: "Checklist" },
  network: { icon: Network, label: "Systems" },
  code: { icon: CodeXml, label: "Code" },
  "book-check": { icon: BookOpenCheck, label: "Case" },
} as const satisfies Record<string, { icon: LucideIcon; label: string }>;

export type KindIconKey = keyof typeof KIND_ICONS;
export const KIND_ICON_KEYS = Object.keys(KIND_ICONS) as [KindIconKey, ...KindIconKey[]];

/** The icon a kind gets when admin hasn't chosen one: built-in kinds by name, anything else a speech bubble. */
const DEFAULT_KIND_ICON: Partial<Record<string, KindIconKey>> = {
  "HR interview": "users",
  "Recruiter screen": "phone",
  "Behavioral interview": "heart-handshake",
  "Managerial interview": "briefcase",
  "Technical concepts": "cpu",
  "Product management": "package",
  "Project management": "kanban",
  Leadership: "crown",
  "Stakeholder and client communication": "presentation",
  "Sales and account management": "trending-up",
  "Customer success and support": "headset",
  "Guesstimates and problem-solving": "puzzle",
  "Salary and offer discussion": "hand-coins",
  "Final round": "trophy",
  // Earlier kinds, for older bookings.
  "Technical interview": "cpu",
  "System design": "network",
  Coding: "code",
  "Data analytics": "chart-column",
  "Case study": "book-check",
};

const isKey = (k: string | undefined): k is KindIconKey => !!k && k in KIND_ICONS;

/** The icon key for a kind: admin's choice, else the built-in default, else "messages". */
export function kindIconKey(kind: string, chosen?: Record<string, string>): KindIconKey {
  const picked = chosen?.[kind];
  if (isKey(picked)) return picked;
  return DEFAULT_KIND_ICON[kind] ?? "messages";
}

export function categoryIcon(kind: string, chosen?: Record<string, string>): LucideIcon {
  return KIND_ICONS[kindIconKey(kind, chosen)].icon;
}
