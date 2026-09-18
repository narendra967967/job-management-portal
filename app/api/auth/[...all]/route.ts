import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

// Better Auth's OAuth callback + session endpoints.
export const { GET, POST } = toNextJsHandler(auth.handler);
