// Mock user data for the admin Users screen (UI-first). Replaced by real DB
// reads in the backend phase.

export type AdminUserStatus = "active" | "inactive";
export type AdminUserRole = "user" | "admin";
// Subscription plan — payment/extension flow comes later; the field is kept now.
export type AdminPlan = "free" | "monthly" | "quarterly" | "half-yearly" | "yearly";

export const PLAN_LABELS: Record<AdminPlan, string> = {
  free: "Free",
  monthly: "Monthly",
  quarterly: "Quarterly",
  "half-yearly": "Half-yearly",
  yearly: "Yearly",
};

export const ROLE_LABELS: Record<AdminUserRole, string> = {
  user: "User",
  admin: "Admin",
};

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  mobile: string;
  role: AdminUserRole;
  status: AdminUserStatus;
  plan: AdminPlan;
  /** Account/subscription expiry (ISO date), or null for no expiry (e.g. Free). */
  expiresAt: string | null;
  createdAt: string;
  lastActive: string;
  leads: number;
}

export const MOCK_USERS: AdminUser[] = [
  { id: "u_dev", name: "Narendra Gupta", email: "narendragpt967967@gmail.com", mobile: "+91 98765 43210", role: "admin", status: "active", plan: "yearly", expiresAt: "2027-08-14", createdAt: "2026-08-14", lastActive: "2h ago", leads: 548 },
  { id: "u_kunal", name: "Kunal Prakash", email: "kunalprakash.me@gmail.com", mobile: "+91 90000 10000", role: "user", status: "active", plan: "free", expiresAt: null, createdAt: "2026-09-26", lastActive: "5h ago", leads: 0 },
  { id: "u_asha", name: "Asha Verma", email: "asha.verma@example.com", mobile: "+91 91111 22222", role: "user", status: "active", plan: "monthly", expiresAt: "2026-10-10", createdAt: "2026-09-10", lastActive: "3d ago", leads: 27 },
  { id: "u_rahul", name: "Rahul Mehta", email: "rahul.mehta@example.com", mobile: "+91 93333 44444", role: "user", status: "inactive", plan: "quarterly", expiresAt: "2026-08-30", createdAt: "2026-07-30", lastActive: "3w ago", leads: 12 },
  { id: "u_sara", name: "Sara Khan", email: "sara.khan@example.com", mobile: "+91 95555 66666", role: "user", status: "active", plan: "half-yearly", expiresAt: "2027-03-22", createdAt: "2026-09-22", lastActive: "1d ago", leads: 6 },
  { id: "u_dev2", name: "Imran Sheikh", email: "imran.sheikh@example.com", mobile: "+91 96666 77777", role: "user", status: "active", plan: "monthly", expiresAt: "2026-10-05", createdAt: "2026-09-05", lastActive: "6h ago", leads: 41 },
  { id: "u_priya", name: "Priya Nair", email: "priya.nair@example.com", mobile: "+91 97777 88888", role: "user", status: "active", plan: "yearly", expiresAt: "2027-01-18", createdAt: "2026-01-18", lastActive: "2d ago", leads: 133 },
  { id: "u_vik", name: "Vikram Rao", email: "vikram.rao@example.com", mobile: "+91 98888 99999", role: "user", status: "inactive", plan: "free", expiresAt: null, createdAt: "2026-06-11", lastActive: "2mo ago", leads: 3 },
  { id: "u_neha", name: "Neha Kapoor", email: "neha.kapoor@example.com", mobile: "+91 99999 00000", role: "user", status: "active", plan: "quarterly", expiresAt: "2026-12-01", createdAt: "2026-09-01", lastActive: "4h ago", leads: 58 },
  { id: "u_arjun", name: "Arjun Singh", email: "arjun.singh@example.com", mobile: "+91 90101 20202", role: "user", status: "active", plan: "monthly", expiresAt: "2026-09-30", createdAt: "2026-08-30", lastActive: "1h ago", leads: 19 },
  { id: "u_meera", name: "Meera Iyer", email: "meera.iyer@example.com", mobile: "+91 90303 40404", role: "user", status: "active", plan: "yearly", expiresAt: "2027-05-02", createdAt: "2026-05-02", lastActive: "5d ago", leads: 88 },
  { id: "u_dan", name: "Daniel Fernandes", email: "daniel.f@example.com", mobile: "+91 90505 60606", role: "user", status: "inactive", plan: "half-yearly", expiresAt: "2026-09-15", createdAt: "2026-03-15", lastActive: "1mo ago", leads: 21 },
  { id: "u_zoya", name: "Zoya Ahmed", email: "zoya.ahmed@example.com", mobile: "+91 90707 80808", role: "user", status: "active", plan: "free", expiresAt: null, createdAt: "2026-09-20", lastActive: "8h ago", leads: 2 },
  { id: "u_karan", name: "Karan Malhotra", email: "karan.m@example.com", mobile: "+91 90909 10101", role: "user", status: "active", plan: "monthly", expiresAt: "2026-10-12", createdAt: "2026-09-12", lastActive: "3d ago", leads: 34 },
];
