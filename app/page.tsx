"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/app-shell/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier.trim() || !password.trim()) {
      setError("Enter your email or mobile number and password.");
      return;
    }
    setError("");
    // Phase 1 mock. Phase 3 authenticates via Better Auth (credentials).
    router.push("/leads");
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <Logo showName={false} className="scale-125" />
          <h1 className="mt-5 text-xl font-medium">Job Management Portal</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Sign in to your workspace.
          </p>
        </div>

        <form onSubmit={submit} className="mt-8 rounded-2xl border bg-card p-6">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Email or mobile number
            </span>
            <Input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="you@example.com or +1 555 018 2245"
              autoComplete="username"
            />
          </label>
          <label className="mt-3 block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Password
            </span>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>

          {error && <p className="mt-3 text-xs text-destructive">{error}</p>}

          <Button type="submit" className="mt-5 w-full">
            Sign in
          </Button>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Connect Google for Gmail sync later, from Settings.
          </p>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Personal, single-user system.
        </p>
      </div>
    </main>
  );
}
