import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { STAFF_ROLES } from "@/lib/staff/types";
import { getStaffContacts, upsertStaffContact } from "@/lib/staff/store";
import { createSupabaseAdminClient, createSupabaseServerAnonClient } from "@/lib/supabase/admin";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type GuardResult = { response: NextResponse } | { role: string };

const RoleEnum = z.enum(STAFF_ROLES);

const CreateSchema = z.object({
  full_name: z.string().trim().min(3).max(120),
  email: z.string().trim().email().max(120),
  phone: z.string().trim().max(40).optional().nullable(),
  role: RoleEnum,
});

async function requireRole(
  supabase: SupabaseServerClient,
  allowed: string[]
): Promise<GuardResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: staff, error } = await supabase
    .from("users")
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) {
    return { response: NextResponse.json({ error: error.message }, { status: 400 }) };
  }

  const role = staff?.role ?? null;
  if (!role || !allowed.includes(role)) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { role };
}

const STAFF_COLUMNS = "id, full_name, email, role, auth_user_id, created_at";

async function findAuthUserByEmail(adminClient: ReturnType<typeof createSupabaseAdminClient>, email: string) {
  if (!adminClient) return null;

  const normalized = email.trim().toLowerCase();
  let page = 1;
  const perPage = 100;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(error.message);
    }
    const users: User[] = data?.users ?? [];
    const match = users.find((user) => (user.email ?? "").toLowerCase() === normalized);
    if (match) {
      return match;
    }
    if (users.length < perPage) {
      break;
    }
    page += 1;
  }

  return null;
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const guard = await requireRole(supabase, ["admin"]);
  if ("response" in guard) return guard.response;

  const { data, error } = await supabase
    .from("users")
    .select(STAFF_COLUMNS)
    .order("full_name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const contacts = await getStaffContacts(supabase);
  const map = new Map(contacts.map((contact) => [contact.id, contact]));
  const enriched = (data ?? []).map((row) => ({
    ...row,
    phone: map.get(row.id ?? "")?.phone ?? null,
    pending: map.get(row.id ?? "")?.pending ?? false,
  }));

  return NextResponse.json({ ok: true, staff: enriched });
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const guard = await requireRole(supabase, ["admin"]);
  if ("response" in guard) return guard.response;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("email", parsed.data.email)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Email already exists" }, { status: 409 });
  }

  const redirectTo =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000";

  const baseRedirect = `${redirectTo.replace(/\/$/, "")}/auth/callback`;

  let authUserId: string | null = null;
  let pendingInvite = true;

  const supabaseAdmin = createSupabaseAdminClient();

  if (supabaseAdmin) {
    const invite = await supabaseAdmin.auth.admin.inviteUserByEmail(parsed.data.email, {
      data: { full_name: parsed.data.full_name },
      redirectTo: baseRedirect,
    });

    if (invite.error) {
      if (invite.error.message.toLowerCase().includes("already")) {
        const existingUser = await findAuthUserByEmail(supabaseAdmin, parsed.data.email);
        if (!existingUser) {
          return NextResponse.json({ error: invite.error.message }, { status: 400 });
        }

        authUserId = existingUser.id;
        pendingInvite = true;

        const anonClient = createSupabaseServerAnonClient();
        if (!anonClient) {
          return NextResponse.json({ error: "Supabase credentials missing" }, { status: 500 });
        }

        const magicLink = await anonClient.auth.signInWithOtp({
          email: parsed.data.email,
          options: { emailRedirectTo: baseRedirect },
        });

        if (magicLink.error) {
          return NextResponse.json({ error: magicLink.error.message }, { status: 400 });
        }
      } else {
        return NextResponse.json({ error: invite.error.message }, { status: 400 });
      }
    } else {
      authUserId = invite.data.user?.id ?? null;
      if (!authUserId) {
        return NextResponse.json({ error: "Failed to obtain invited user id" }, { status: 500 });
      }
      pendingInvite = true;
    }
  } else {
    const anonClient = createSupabaseServerAnonClient();
    if (!anonClient) {
      return NextResponse.json({ error: "Supabase credentials missing" }, { status: 500 });
    }

    const tempPassword = `Temp-${randomUUID().replace(/-/g, "").slice(0, 20)}`;

    const signup = await anonClient.auth.signUp({
      email: parsed.data.email,
      password: tempPassword,
      options: {
        data: { full_name: parsed.data.full_name },
        emailRedirectTo: baseRedirect,
      },
    });

    if (signup.error) {
      if (signup.error.message.includes("already registered")) {
        return NextResponse.json({ error: "Email already registered" }, { status: 409 });
      }
      return NextResponse.json({ error: signup.error.message }, { status: 400 });
    }

    authUserId = signup.data.user?.id ?? null;
    if (!authUserId) {
      return NextResponse.json({ error: "Failed to complete invite" }, { status: 500 });
    }
  }

  const { data, error } = await supabase
    .from("users")
    .insert({
      full_name: parsed.data.full_name,
      email: parsed.data.email,
      auth_user_id: authUserId,
      role: parsed.data.role,
    })
    .select(STAFF_COLUMNS)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await upsertStaffContact(data.id, parsed.data.phone ?? null, pendingInvite, supabase);

  return NextResponse.json(
    {
      ok: true,
      staff: { ...data, phone: parsed.data.phone ?? null, pending: pendingInvite },
    },
    { status: 201 }
  );
}
