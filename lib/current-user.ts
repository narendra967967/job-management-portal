import "server-only";

// Resolves the acting user's id for data-layer reads/writes.
//
// PHASE 3 / Milestone A (now): auth isn't wired yet, so we fall back to the
// fixed dev user the seed created (DEV_USER_ID). Once Better Auth lands
// (Milestone B), this reads the Better Auth session and returns the real
// signed-in user's id — the single-email allow-list guarantees it's the owner.

export async function getCurrentUserId(): Promise<string> {
  // Milestone B replaces this block with a Better Auth session lookup:
  //   const session = await auth.api.getSession({ headers: await headers() });
  //   if (!session) redirect("/");   return session.user.id;
  const devUser = process.env.DEV_USER_ID ?? "dev-user";
  return devUser;
}
