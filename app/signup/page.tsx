import { redirect } from "next/navigation";

// Self-registration UI + wiring (allowSignup gate, email verification, Free-plan
// assignment, rate limiting) is built in the next step. Until then, keep the route
// valid by sending visitors to the login page.
export default function SignupPage() {
  redirect("/login");
}
