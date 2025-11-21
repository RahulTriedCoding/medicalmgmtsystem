"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function AuthCallbackInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [status, setStatus] = useState<"pending" | "error" | "success">("pending");
  const [message, setMessage] = useState("Completing sign-in…");

  useEffect(() => {
    (async () => {
      const code = searchParams.get("code");
      const access_token = searchParams.get("access_token");
      const refresh_token = searchParams.get("refresh_token");
      const type = searchParams.get("type");

      console.log("[auth/callback] params", { code, type, hasTokens: !!(access_token && refresh_token) });

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          setMessage("Signed in. Redirecting…");
          setStatus("success");
          router.replace("/dashboard");
          return;
        }

        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) throw error;
          setMessage("Session restored. Redirecting…");
          setStatus("success");
          router.replace("/dashboard");
          return;
        }

        setStatus("error");
        setMessage("Missing login code. Please request a new link.");
      } catch (err) {
        console.error("[auth/callback] failed to establish session", err);
        setStatus("error");
        setMessage("Unable to sign you in. Please request a new link.");
      }
    })();
  }, [router, searchParams, supabase.auth]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/50 p-6 text-center text-white shadow-xl">
        <h1 className="text-2xl font-semibold">Secure sign-in</h1>
        <p className="mt-3 text-sm text-white/70">{message}</p>
        {status === "pending" && <div className="mt-4 animate-pulse text-xs text-white/60">Working…</div>}
        {status === "error" && (
          <p className="mt-4 text-sm text-rose-300">
            If this keeps happening, ask an admin to resend your invite link.
          </p>
        )}
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-white">Loading…</div>}>
      <AuthCallbackInner />
    </Suspense>
  );
}
