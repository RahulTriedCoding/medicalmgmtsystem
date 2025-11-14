import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getClinicalNotesForPatient } from "@/lib/clinical-notes/store";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type GuardResult = { response: NextResponse } | { role: string; staffId: string | null };
type ParamsShape = { id?: string } | Promise<{ id?: string }>;

async function requireDoctorOrAdmin(
  supabase: SupabaseServerClient
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
  if (!role || !["admin", "doctor"].includes(role)) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { role, staffId: staff?.id ?? null };
}

async function resolveId(params: ParamsShape) {
  const resolved = await params;
  const id = resolved?.id ?? "";
  if (!id || typeof id !== "string") return null;
  return id;
}

export async function GET(_: Request, { params }: { params: ParamsShape }) {
  const supabase = await createSupabaseServerClient();
  const guard = await requireDoctorOrAdmin(supabase);
  if ("response" in guard) return guard.response;

  const id = await resolveId(params);
  if (!id) {
    return NextResponse.json({ error: "Invalid patient id" }, { status: 400 });
  }

  try {
    const notes = await getClinicalNotesForPatient(
      id,
      supabase,
      guard.role === "doctor" ? { doctorId: guard.staffId ?? undefined } : undefined
    );
    return NextResponse.json({ ok: true, notes });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load notes";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
