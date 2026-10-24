import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { captchaSiteKey } from "@/lib/captcha";

// Admin login. Server page so the reCAPTCHA site key (admin Settings →
// Security) reaches the form; the form itself is a client component.
export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  return <AdminLoginForm captchaSiteKey={await captchaSiteKey()} />;
}
