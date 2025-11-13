import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deletePrescription, findPrescription } from "@/lib/prescriptions/store";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type GuardResult = { response: NextResponse } | { role: string };
type ParamsShape = { id?: string } | Promise<{ id?: string }>;

const IdSchema = z.object({ id: z.string().uuid() });

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

async function resolveId(params: ParamsShape) {
  const resolved = await params;
  const parsed = IdSchema.safeParse({ id: resolved?.id ?? "" });
  if (!parsed.success) return null;
  return parsed.data.id;
}

export async function GET(_: Request, { params }: { params: ParamsShape }) {
  const supabase = await createSupabaseServerClient();
  const guard = await requireRole(supabase, ["admin", "doctor", "receptionist"]);
  if ("response" in guard) return guard.response;

  const id = await resolveId(params);
  if (!id) {
    return NextResponse.json({ error: "Invalid prescription id" }, { status: 400 });
  }

  const record = await findPrescription(id);
  if (!record) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [{ data: patient }, { data: doctor }] = await Promise.all([
    supabase.from("patients").select("full_name, mrn").eq("id", record.patient_id).maybeSingle(),
    supabase.from("users").select("full_name").eq("id", record.doctor_id).maybeSingle(),
  ]);

  return NextResponse.json({
    ok: true,
    prescription: {
      ...record,
      patients: patient ?? null,
      doctor: doctor ?? null,
    },
  });
}

export async function DELETE(_: Request, { params }: { params: ParamsShape }) {
  const supabase = await createSupabaseServerClient();
  const guard = await requireRole(supabase, ["admin"]);
  if ("response" in guard) return guard.response;

  const id = await resolveId(params);
  if (!id) {
    return NextResponse.json({ error: "Invalid prescription id" }, { status: 400 });
  }

  const removed = await deletePrescription(id);
  if (!removed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
