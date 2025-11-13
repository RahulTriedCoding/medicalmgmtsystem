import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { addInvoice, getInvoices } from "@/lib/billing/store";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type GuardResult = { response: NextResponse } | { role: string };

const LineSchema = z.object({
  description: z.string().trim().min(3).max(200),
  quantity: z.number().positive(),
  unit_price: z.number().nonnegative(),
});

const InvoiceSchema = z.object({
  patient_id: z.string().uuid(),
  due_date: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), { message: "Invalid due date" }),
  notes: z.string().trim().max(500).optional().nullable(),
  line_items: z.array(LineSchema).min(1),
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

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const guard = await requireRole(supabase, ["admin", "receptionist", "doctor"]);
  if ("response" in guard) return guard.response;

  const invoices = await getInvoices();
  return NextResponse.json({ ok: true, invoices });
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const guard = await requireRole(supabase, ["admin", "receptionist"]);
  if ("response" in guard) return guard.response;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = InvoiceSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data: patient, error } = await supabase
    .from("patients")
    .select("id")
    .eq("id", parsed.data.patient_id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!patient) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  const invoice = await addInvoice({
    patient_id: parsed.data.patient_id,
    due_date: parsed.data.due_date,
    notes: parsed.data.notes ?? null,
    line_items: parsed.data.line_items,
  });

  return NextResponse.json({ ok: true, invoice }, { status: 201 });
}
