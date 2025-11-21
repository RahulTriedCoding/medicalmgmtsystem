import { NextResponse } from "next/server";
import { z } from "zod";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { STAFF_ROLES } from "@/lib/staff/types";
import { getStaffContacts, upsertStaffContact } from "@/lib/staff/store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStaffRole } from "@/lib/staff/permissions";

const RoleEnum = z.enum(STAFF_ROLES);

const CreateSchema = z.object({
  full_name: z.string().trim().min(3).max(120),
  email: z.string().trim().email().max(120),
  phone: z.string().trim().max(40).optional().nullable(),
  role: RoleEnum,
});

const STAFF_COLUMNS = "id, full_name, email, role, auth_user_id, created_at, is_active, deactivated_at";

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const inviteRedirectTo =
  `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}`.replace(/\/$/, "") + "/auth/callback";

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
  const guard = await requireStaffRole(supabase, ["admin"]);
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

async function sendAuthLink(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  email: string,
  full_name: string,
  mode: "invite" | "magiclink" | "recovery"
) {
  if (!adminClient) {
    throw new Error("Supabase admin client unavailable");
  }

  if (mode === "recovery") {
    const recovery = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: inviteRedirectTo },
    });
    if (recovery.error) {
      console.error("[staff:invite] failed to send recovery link", { email, error: recovery.error });
      throw new Error(recovery.error.message);
    }
    return { sent: true, mode: "recovery" as const, user: recovery.data.user ?? null };
  }

  if (mode === "magiclink") {
    const magic = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: inviteRedirectTo },
    });
    if (magic.error) {
      console.error("[staff:invite] failed to send magic link", { email, error: magic.error });
      throw new Error(magic.error.message);
    }
    return { sent: true, mode: "magiclink" as const, user: magic.data.user ?? null };
  }

  const invite = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: inviteRedirectTo,
    data: { full_name },
  });
  if (invite.error) {
    console.error("[staff:invite] failed to send invite", { email, error: invite.error });
    throw new Error(invite.error.message);
  }
  return { sent: true, mode: "invite" as const, user: invite.data.user ?? null };
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const guard = await requireStaffRole(supabase, ["admin"]);
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

  const fullName = parsed.data.full_name.trim();
  const normalizedEmail = normalizeEmail(parsed.data.email);
  const phone = parsed.data.phone ?? null;
  const role = parsed.data.role;

  console.log("[staff/invite] payload", { fullName, email: normalizedEmail, role, phone });

  const { data: existing, error: lookupError } = await supabase
    .from("users")
    .select("id, is_active, auth_user_id, deactivated_at, email")
    .ilike("email", normalizedEmail)
    .maybeSingle();

  if (lookupError) {
    console.error("[staff/invite] staff lookup error", { email: normalizedEmail, error: lookupError });
    return NextResponse.json({ ok: false, code: "LOOKUP_FAILED", error: lookupError.message }, { status: 400 });
  }

  console.log("[staff/invite] existing staff row", existing ?? null);

  const supabaseAdmin = createSupabaseAdminClient();
  if (!supabaseAdmin) {
    return NextResponse.json(
      { ok: false, code: "ADMIN_CLIENT_MISSING", error: "Supabase service role key missing" },
      { status: 500 }
    );
  }

  let authUser = await findAuthUserByEmail(supabaseAdmin, normalizedEmail);
  console.log("[staff/invite] existing auth user", authUser?.id ?? null);

  const pendingInvite = true;
  let inviteMode: "invite" | "magiclink" | "recovery" | null = null;
  let staffRecord;

  // Case 2: active staff
  if (authUser && existing && existing.deactivated_at === null) {
    return NextResponse.json(
      { ok: false, code: "ALREADY_ACTIVE", error: "Staff member with this email is already active" },
      { status: 409 }
    );
  }

  // Case 3: auth + staff exists but revoked
  if (authUser && existing && existing.deactivated_at !== null) {
    try {
      inviteMode = (await sendAuthLink(supabaseAdmin, normalizedEmail, fullName, "magiclink")).mode;
    } catch (err) {
      console.error("[staff/invite] error sending magiclink for reactivation", { email: normalizedEmail, error: err });
      return NextResponse.json(
        { ok: false, code: "INVITE_FAILED", error: err instanceof Error ? err.message : "Failed to send invite" },
        { status: 400 }
      );
    }
    const updateResult = await supabase
      .from("users")
      .update({
        full_name: fullName,
        email: normalizedEmail,
        auth_user_id: authUser.id,
        role,
        is_active: true,
        deactivated_at: null,
      })
      .eq("id", existing.id)
      .select(STAFF_COLUMNS)
      .single();

    if (updateResult.error) {
      console.error("[staff/invite] failed to reactivate staff row", { email: normalizedEmail, error: updateResult.error });
      return NextResponse.json({ ok: false, code: "STAFF_UPDATE_FAILED", error: updateResult.error.message }, { status: 400 });
    }
    staffRecord = updateResult.data;
  }

  // Case 4: auth exists but no staff row
  if (authUser && !staffRecord && !existing) {
    try {
      inviteMode = (await sendAuthLink(supabaseAdmin, normalizedEmail, fullName, "magiclink")).mode;
    } catch (err) {
      console.error("[staff/invite] error sending magiclink for existing auth user", { email: normalizedEmail, error: err });
      return NextResponse.json(
        { ok: false, code: "INVITE_FAILED", error: err instanceof Error ? err.message : "Failed to send invite" },
        { status: 400 }
      );
    }
    const insertResult = await supabase
      .from("users")
      .insert({
        full_name: fullName,
        email: normalizedEmail,
        auth_user_id: authUser.id,
        role,
        is_active: true,
        deactivated_at: null,
      })
      .select(STAFF_COLUMNS)
      .single();

      if (insertResult.error) {
        if (insertResult.error.message.includes("users_auth_user_id_key")) {
          const { data: existingUser } = await supabase
            .from("users")
            .select(STAFF_COLUMNS)
            .eq("auth_user_id", authUser.id)
            .maybeSingle();
          if (existingUser) {
            staffRecord = existingUser;
          } else {
            console.error("[staff/invite] auth_user_id conflict but no row found", { email: normalizedEmail, error: insertResult.error });
            return NextResponse.json({ ok: false, code: "STAFF_INSERT_FAILED", error: insertResult.error.message }, { status: 400 });
          }
        } else {
          console.error("[staff/invite] failed to create staff row for existing auth user", {
            email: normalizedEmail,
            error: insertResult.error,
          });
          return NextResponse.json({ ok: false, code: "STAFF_INSERT_FAILED", error: insertResult.error.message }, { status: 400 });
        }
      } else {
        staffRecord = insertResult.data;
      }
    }

  // Case 1: brand new email
  if (!authUser) {
    try {
      const invite = await sendAuthLink(supabaseAdmin, normalizedEmail, fullName, "invite");
      inviteMode = invite.mode;
      authUser = invite.user ?? (await findAuthUserByEmail(supabaseAdmin, normalizedEmail));
    } catch (err) {
      console.error("[staff/invite] error creating/inviting new user", { email: normalizedEmail, error: err });
      return NextResponse.json(
        { ok: false, code: "INVITE_FAILED", error: err instanceof Error ? err.message : "Failed to invite staff" },
        { status: 400 }
      );
    }
    if (!authUser?.id) {
      return NextResponse.json({ ok: false, code: "NO_AUTH_USER", error: "Failed to obtain invited user id" }, { status: 500 });
    }

    const insertResult = await supabase
      .from("users")
      .insert({
        full_name: fullName,
        email: normalizedEmail,
        auth_user_id: authUser.id,
        role,
        is_active: true,
        deactivated_at: null,
      })
      .select(STAFF_COLUMNS)
      .single();

    if (insertResult.error) {
      if (insertResult.error.message.includes("users_auth_user_id_key")) {
        const { data: existingUser } = await supabase
          .from("users")
          .select(STAFF_COLUMNS)
          .eq("auth_user_id", authUser.id)
          .maybeSingle();
        if (existingUser) {
          staffRecord = existingUser;
        } else {
          console.error("[staff/invite] auth_user_id conflict for new user", { email: normalizedEmail, error: insertResult.error });
          return NextResponse.json({ ok: false, code: "STAFF_INSERT_FAILED", error: insertResult.error.message }, { status: 400 });
        }
      } else {
        console.error("[staff/invite] failed to create staff row for new auth user", {
          email: normalizedEmail,
          error: insertResult.error,
        });
        return NextResponse.json({ ok: false, code: "STAFF_INSERT_FAILED", error: insertResult.error.message }, { status: 400 });
      }
    } else {
      staffRecord = insertResult.data;
    }
  }

  if (!staffRecord) {
    console.error("[staff/invite] no staff record created or found", { email: normalizedEmail });
    return NextResponse.json({ ok: false, code: "STAFF_UNKNOWN", error: "Staff record not created" }, { status: 400 });
  }

  await upsertStaffContact(staffRecord.id, phone, pendingInvite, supabase);

  return NextResponse.json(
    {
      ok: true,
      staff: { ...staffRecord, phone, pending: pendingInvite },
      inviteMode: inviteMode ?? "magiclink",
      message:
        inviteMode === "recovery"
          ? `Reactivated and sent a login link to ${normalizedEmail}`
          : `Invitation sent to ${normalizedEmail}`,
    },
    { status: 201 }
  );
}
