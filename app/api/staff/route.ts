import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
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

  const supabaseAdmin = createSupabaseAdminClient();

  if (supabaseAdmin) {
    const invite = await supabaseAdmin.auth.admin.inviteUserByEmail(parsed.data.email, {
      data: { full_name: parsed.data.full_name },
      emailRedirectTo: baseRedirect,
    });

    if (invite.error) {
      return NextResponse.json({ error: invite.error.message }, { status: 400 });
    }

    authUserId = invite.data.user?.id ?? null;
    if (!authUserId) {
      return NextResponse.json({ error: "Failed to obtain invited user id" }, { status: 500 });
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

  await upsertStaffContact(data.id, parsed.data.phone ?? null, true, supabase);

  return NextResponse.json(
    { ok: true, staff: { ...data, phone: parsed.data.phone ?? null, pending: true } },
    { status: 201 }
  );
}
