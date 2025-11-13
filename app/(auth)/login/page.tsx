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
    <div className="max-w-sm mx-auto pt-24 space-y-4">
      <h1 className="text-2xl font-semibold">Login</h1>
      <p className="text-sm text-muted-foreground">
        Enter your email to receive a magic link.
      </p>
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@clinic.com"
          className="w-full border rounded-md px-3 py-2"
        />
        <button
          disabled={loading}
          className="rounded-md px-3 py-2 border disabled:opacity-50"
        >
          {loading ? "Sending..." : "Send magic link"}
        </button>
      </form>
    </div>
  );
}
