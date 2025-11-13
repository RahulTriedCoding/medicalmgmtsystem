import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getPrescriptions,
  addPrescription,
  StoredPrescription,
} from "@/lib/prescriptions/store";
import {
  consumeInventory,
  getInventoryItems,
  InventoryShortage,
} from "@/lib/inventory/store";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type GuardResult = { response: NextResponse } | { role: string };

const LineSchema = z.object({
  item_id: z.string().min(1),
  dosage: z.string().trim().min(1).max(200),
  quantity: z.number().int().positive(),
});

const PrescriptionSchema = z.object({
  patient_id: z.string().uuid(),
  doctor_id: z.string().uuid(),
  notes: z.string().trim().max(500).optional().nullable(),
  lines: z.array(LineSchema).min(1),
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

function coerceMap<T extends { id: string }>(rows: T[] | null | undefined) {
  return new Map((rows ?? []).map((row) => [row.id, row]));
}

function enrichPrescriptions(
  prescriptions: StoredPrescription[],
  patientMap: Map<string, { full_name: string | null }>,
  doctorMap: Map<string, { full_name: string | null }>
) {
  return prescriptions.map((row) => ({
    ...row,
    patient_name: patientMap.get(row.patient_id)?.full_name ?? null,
    doctor_name: doctorMap.get(row.doctor_id)?.full_name ?? null,
  }));
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const guard = await requireRole(supabase, ["admin", "doctor", "receptionist"]);
  if ("response" in guard) return guard.response;

  const prescriptions = await getPrescriptions(supabase);
  const patientIds = Array.from(new Set(prescriptions.map((p) => p.patient_id)));
  const doctorIds = Array.from(new Set(prescriptions.map((p) => p.doctor_id)));

  const [patientsQuery, doctorsQuery] = await Promise.all([
    patientIds.length
      ? supabase.from("patients").select("id, full_name").in("id", patientIds)
      : Promise.resolve<{ data: { id: string; full_name: string | null }[] }>({ data: [] }),
    doctorIds.length
      ? supabase.from("users").select("id, full_name").in("id", doctorIds)
      : Promise.resolve<{ data: { id: string; full_name: string | null }[] }>({ data: [] }),
  ]);

  const patientMap = coerceMap(patientsQuery.data ?? []);
  const doctorMap = coerceMap(doctorsQuery.data ?? []);

  return NextResponse.json({
    ok: true,
    prescriptions: enrichPrescriptions(prescriptions, patientMap, doctorMap),
  });
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const guard = await requireRole(supabase, ["admin", "doctor", "receptionist"]);
  if ("response" in guard) return guard.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PrescriptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [patientResult, doctorResult] = await Promise.all([
    supabase.from("patients").select("id, full_name").eq("id", parsed.data.patient_id).maybeSingle(),
    supabase
      .from("users")
      .select("id, full_name")
      .eq("id", parsed.data.doctor_id)
      .eq("role", "doctor")
      .maybeSingle(),
  ]);

  if (patientResult.error) {
    return NextResponse.json({ error: patientResult.error.message }, { status: 400 });
  }
  if (!patientResult.data) {
    return NextResponse.json({ error: "Patient not found" }, { status: 400 });
  }

  if (doctorResult.error) {
    return NextResponse.json({ error: doctorResult.error.message }, { status: 400 });
  }
  if (!doctorResult.data) {
    return NextResponse.json({ error: "Doctor not found" }, { status: 400 });
  }

  const inventoryItems = await getInventoryItems(supabase);
  const inventoryMap = new Map(inventoryItems.map((item) => [item.id, item]));

  const totals = parsed.data.lines.reduce<Record<string, number>>((acc, line) => {
    acc[line.item_id] = (acc[line.item_id] ?? 0) + line.quantity;
    return acc;
  }, {});

  const requirements = Object.entries(totals).map(([item_id, quantity]) => ({
    item_id,
    quantity,
  }));

  const consumption = await consumeInventory(requirements, supabase);
  if (consumption.shortages.length) {
    return NextResponse.json(
      { error: "insufficient_stock", details: consumption.shortages as InventoryShortage[] },
      { status: 400 }
    );
  }

  const normalizedLines = parsed.data.lines.map((line) => ({
    item_id: line.item_id,
    dosage: line.dosage,
    quantity: line.quantity,
    name: inventoryMap.get(line.item_id)?.name ?? "Item",
  }));

  const prescription = await addPrescription(
    {
      patient_id: parsed.data.patient_id,
      doctor_id: parsed.data.doctor_id,
      notes: parsed.data.notes?.trim() ? parsed.data.notes.trim() : null,
      lines: normalizedLines,
    },
    supabase
  );

  return NextResponse.json({
    ok: true,
    prescription: {
      ...prescription,
      patient_name: patientResult.data.full_name,
      doctor_name: doctorResult.data.full_name,
    },
  });
}
