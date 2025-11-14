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
    <div className="surface mt-4 space-y-2 rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-xs text-white/70 shadow-inner shadow-black/40">
      {loading ? (
        <div className="animate-pulse text-white/60">Loading user…</div>
      ) : me ? (
        <>
          <div className="text-[13px] font-semibold text-white truncate">
            {me.email ?? "—"}
          </div>
          <div className="text-muted-foreground">Role: {me.role ?? "—"}</div>
          <button
            onClick={signOut}
            className="btn-secondary mt-3 w-full justify-center text-xs"
          >
            Sign out
          </button>
        </>
      ) : (
        <>
          <div className="text-muted-foreground">Not signed in</div>
          <button
            onClick={() => router.push("/login")}
            className="btn-secondary mt-3 w-full justify-center text-xs"
          >
            Go to login
          </button>
        </>
      )}
    </div>
  );
}
