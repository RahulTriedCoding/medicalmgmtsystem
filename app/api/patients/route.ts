// app/api/patients/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const PatientSchema = z.object({
  mrn: z.string().min(1),
  full_name: z.string().min(1),
  phone: z.string().optional().nullable(),
  dob: z.string().optional().nullable(),       // "YYYY-MM-DD"
  gender: z.enum(["male", "female", "other"]).optional().nullable(),
  address: z.string().optional().nullable(),
  allergies: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  // ensure user is logged in
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json();
  const parsed = PatientSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;

  const { data, error } = await supabase
    .from("patients")
    .insert({
      mrn: payload.mrn,
      full_name: payload.full_name,
      phone: payload.phone ?? null,
      dob: payload.dob ?? null,
      gender: payload.gender ?? null,
      address: payload.address ?? null,
      allergies: payload.allergies ?? null,
      // created_by is auto-allowed; audit trigger will write a log
    })
    .select("id, mrn, full_name")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, patient: data });
}
