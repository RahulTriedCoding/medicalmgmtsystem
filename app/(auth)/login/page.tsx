"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorText(null);
    setLoading(true);
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail.length || !trimmedPassword.length) {
      setErrorText("Please enter both email and password.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password: trimmedPassword,
    });
    if (error) {
      setLoading(false);
      console.error("[login] failed email/password sign-in", error);
      setErrorText("Invalid email or password.");
      return;
    }

    try {
      const meResponse = await fetch("/api/auth/me", { cache: "no-store" });
      const payload = await meResponse.json().catch(() => ({}));
      if (!meResponse.ok || !payload?.user) {
        await supabase.auth.signOut();
        setErrorText("Your account is not active or no longer has access.");
        setLoading(false);
        return;
      }
    } catch (err) {
      console.error("[login] failed to confirm staff context", err);
      await supabase.auth.signOut();
      setErrorText("Unable to verify your access. Please try again or contact an administrator.");
      setLoading(false);
      return;
    }

    setLoading(false);
    router.push("/dashboard");
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-[#050505] via-[#090b13] to-[#020202] px-4 py-16">
      <div className="surface w-full max-w-md space-y-5 rounded-3xl border border-white/10 bg-black/30 p-8 text-sm text-muted-foreground">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-white/60">Medical MMS</p>
          <h1 className="text-3xl font-semibold text-white">Secure Access</h1>
          <p className="mt-2 text-sm">
            Sign in with the clinic email and password provided by an administrator to access the control room.
          </p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="grid gap-2 text-sm text-white">
            <span>Email address</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@clinic.com"
              autoComplete="email"
              required
              className="rounded-2xl border border-white/20 bg-white/95 px-4 py-3 text-base text-slate-900 placeholder:text-slate-500 shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-white/10 dark:bg-white/10 dark:text-white dark:placeholder:text-white/70"
            />
          </label>
          <label className="grid gap-2 text-sm text-white">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
              className="rounded-2xl border border-white/20 bg-white/95 px-4 py-3 text-base text-slate-900 placeholder:text-slate-500 shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-white/10 dark:bg-white/10 dark:text-white dark:placeholder:text-white/70"
            />
          </label>
          {errorText && (
            <p className="text-sm font-medium text-rose-400" role="alert">
              {errorText}
            </p>
          )}
          <button disabled={loading} className="btn-primary w-full disabled:opacity-60">
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
