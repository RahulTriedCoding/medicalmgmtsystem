import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { STAFF_ROLES } from "@/lib/staff/types";
import { deleteStaffContact, upsertStaffContact, getStaffContacts } from "@/lib/staff/store";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type GuardResult = { response: NextResponse } | { role: string; staffId: string | null };
type ParamsShape = { id?: string } | Promise<{ id?: string }>;

const RoleEnum = z.enum(STAFF_ROLES);

const IdSchema = z.object({ id: z.string().uuid() });

const UpdateSchema = z
  .object({
    full_name: z.string().trim().min(3).max(120).optional(),
    phone: z
      .union([z.string().trim().max(40), z.literal("").transform(() => null)])
      .optional()
      .nullable(),
    role: RoleEnum.optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Provide at least one field to update",
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
    .select("role, id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) {
    return { response: NextResponse.json({ error: error.message }, { status: 400 }) };
  }

  const role = staff?.role ?? null;
  if (!role || !allowed.includes(role)) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { role, staffId: staff?.id ?? null };
}

async function resolveId(params: ParamsShape) {
  const resolved = await params;
  const parsed = IdSchema.safeParse({ id: resolved?.id ?? "" });
  if (!parsed.success) return null;
  return parsed.data.id;
}

const STAFF_COLUMNS = "id, full_name, email, role, auth_user_id, created_at";

export async function PATCH(req: Request, { params }: { params: ParamsShape }) {
  const supabase = await createSupabaseServerClient();
  const guard = await requireRole(supabase, ["admin"]);
  if ("response" in guard) return guard.response;

  const id = await resolveId(params);
  if (!id) {
    return NextResponse.json({ error: "Invalid staff id" }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = UpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updatePayload: Record<string, unknown> = {};
  if (parsed.data.full_name !== undefined) updatePayload.full_name = parsed.data.full_name;
  if (parsed.data.role !== undefined) updatePayload.role = parsed.data.role;
  const { data, error } = await supabase
    .from("users")
    .update(updatePayload)
    .eq("id", id)
    .select(STAFF_COLUMNS)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let phoneValue: string | null = null;
  let pendingValue = false;
  if (parsed.data.phone !== undefined) {
    await upsertStaffContact(id, parsed.data.phone);
    const updatedContacts = await getStaffContacts();
    const updated = updatedContacts.find((contact) => contact.id === id);
    phoneValue = updated?.phone ?? parsed.data.phone ?? null;
    pendingValue = updated?.pending ?? false;
  } else {
    const contacts = await getStaffContacts();
    const record = contacts.find((contact) => contact.id === id);
    phoneValue = record?.phone ?? null;
    pendingValue = record?.pending ?? false;
  }

  return NextResponse.json({
    ok: true,
    staff: {
      ...data,
      phone: phoneValue,
      pending: pendingValue,
    },
  });
}

export async function DELETE(_: Request, { params }: { params: ParamsShape }) {
  const supabase = await createSupabaseServerClient();
  const guard = await requireRole(supabase, ["admin"]);
  if ("response" in guard) return guard.response;

  const id = await resolveId(params);
  if (!id) {
    return NextResponse.json({ error: "Invalid staff id" }, { status: 400 });
  }

  if (guard.staffId && guard.staffId === id) {
    return NextResponse.json({ error: "You cannot remove yourself" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("users")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await deleteStaffContact(id);

  return NextResponse.json({ ok: true });
}
