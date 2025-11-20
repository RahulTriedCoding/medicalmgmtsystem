import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export const createSupabaseServerClient = async () => {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        // Allow Netlify/SSR responses to persist refreshed sessions
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            console.warn("[auth] failed to set cookie", { name, error });
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options, maxAge: 0 });
          } catch (error) {
            console.warn("[auth] failed to remove cookie", { name, error });
          }
        },
      },
    }
  );
};


