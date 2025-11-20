import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next");
  const next = nextParam && nextParam.startsWith("/") ? nextParam : "/dashboard";
  const cookieStore = await cookies();
  console.info("[auth/callback] invoked", { hasCode: Boolean(code), next });

  if (code) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set({ name, value: "", ...options, maxAge: 0 });
          },
        },
      }
    );

    // Exchange the one-time code for a session and set cookies
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    const sessionUser = data?.session?.user ?? null;

    if (error) {
      console.error("[auth/callback] exchangeCodeForSession failed", { error: error.message, next });
      return NextResponse.redirect(`${origin}/login`);
    }

    console.info("[auth/callback] session established", {
      userId: sessionUser?.id ?? null,
      email: sessionUser?.email ?? null,
      next,
    });
  } else {
    console.warn("[auth/callback] missing code in callback", { redirectingTo: next });
  }

  return NextResponse.redirect(`${origin}${next}`);
}
