"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Me = { email: string | null; role: string | null } | null;

export default function UserMenu() {
  const [me, setMe] = useState<Me>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const json = await res.json();
        setMe(json.user);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="mt-4 space-y-2 rounded-2xl border border-slate-200/80 bg-white/95 p-4 text-xs text-slate-600 shadow-[0_20px_45px_rgba(15,23,42,0.08)] dark:surface dark:border-white/10 dark:bg-white/5 dark:text-white/70">
      {loading ? (
        <div className="animate-pulse text-slate-500 dark:text-white/60">Loading user…</div>
      ) : me ? (
        <>
          <div className="truncate text-[13px] font-semibold text-slate-900 dark:text-white">
            {me.email ?? "—"}
          </div>
          <div className="text-[12px] font-medium text-slate-500 dark:text-white/70">
            Role: <span className="capitalize text-slate-700 dark:text-white/80">{me.role ?? "—"}</span>
          </div>
          <button
            onClick={signOut}
            className="btn-secondary mt-3 w-full justify-center text-sm font-semibold"
          >
            Sign out
          </button>
        </>
      ) : (
        <>
          <div className="text-muted-foreground">Not signed in</div>
          <button
            onClick={() => router.push("/login")}
            className="btn-secondary mt-3 w-full justify-center text-sm font-semibold"
          >
            Go to login
          </button>
        </>
      )}
    </div>
  );
}
