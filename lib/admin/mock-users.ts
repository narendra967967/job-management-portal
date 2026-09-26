// Mock user data for the admin Users screen (UI-first). Replaced by real DB
// reads in the backend phase.

export type AdminUserStatus = "active" | "inactive";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  status: AdminUserStatus;
  createdAt: string; // ISO date
  lastActive: string; // human relative
  leads: number;
}

export const MOCK_USERS: AdminUser[] = [
  { id: "u_dev", name: "Narendra Gupta", email: "narendragpt967967@gmail.com", status: "active", createdAt: "2026-08-14", lastActive: "2h ago", leads: 548 },
  { id: "u_kunal", name: "Kunal Prakash", email: "kunalprakash.me@gmail.com", status: "active", createdAt: "2026-09-26", lastActive: "5h ago", leads: 0 },
  { id: "u_asha", name: "Asha Verma", email: "asha.verma@example.com", status: "active", createdAt: "2026-09-10", lastActive: "3d ago", leads: 27 },
  { id: "u_rahul", name: "Rahul Mehta", email: "rahul.mehta@example.com", status: "inactive", createdAt: "2026-07-30", lastActive: "3w ago", leads: 12 },
  { id: "u_sara", name: "Sara Khan", email: "sara.khan@example.com", status: "active", createdAt: "2026-09-22", lastActive: "1d ago", leads: 6 },
];
