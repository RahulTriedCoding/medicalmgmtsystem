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
    <div className="mt-4 rounded-md border p-3 text-xs">
      {loading ? (
        <div className="animate-pulse">Loading user…</div>
      ) : me ? (
        <>
          <div className="font-medium truncate">{me.email ?? "—"}</div>
          <div className="text-muted-foreground">Role: {me.role ?? "—"}</div>
          <button
            onClick={signOut}
            className="mt-2 inline-flex rounded-md border px-2 py-1"
          >
            Sign out
          </button>
        </>
      ) : (
        <>
          <div className="text-muted-foreground">Not signed in</div>
          <button
            onClick={() => router.push("/login")}
            className="mt-2 inline-flex rounded-md border px-2 py-1"
          >
            Go to login
          </button>
        </>
      )}
    </div>
  );
}
