"use client";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function LoginPage() {
  const supabase = createSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // 👇 land on our server callback so cookies get set
        emailRedirectTo: `${location.origin}/auth/callback?next=/dashboard`,
      },
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("Check your email for the magic login link.");
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-[#050505] via-[#090b13] to-[#020202] px-4 py-16">
      <div className="surface w-full max-w-md space-y-5 rounded-3xl border border-white/10 bg-black/30 p-8 text-sm text-muted-foreground">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-white/60">Medical MMS</p>
          <h1 className="text-3xl font-semibold text-white">Secure Access</h1>
          <p className="mt-2 text-sm">
            Enter your work email and we&apos;ll send a secure magic link to access the control room.
          </p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="grid gap-2 text-sm text-white">
            <span>Email address</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@clinic.com"
              className="field"
            />
          </label>
          <button disabled={loading} className="btn-primary w-full disabled:opacity-60">
            {loading ? "Sending..." : "Send magic link"}
          </button>
        </form>
      </div>
    </div>
  );
}
