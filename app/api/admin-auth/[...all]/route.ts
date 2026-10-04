import { toNextJsHandler } from "better-auth/next-js";
import { authAdmin } from "@/lib/auth-admin";

// Admin-panel auth endpoints (separate cookie + session from the user app).
export const { GET, POST } = toNextJsHandler(authAdmin.handler);
