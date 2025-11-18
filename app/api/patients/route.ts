// app/api/patients/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  BLOOD_GROUP_OPTIONS,
  GENDER_OPTIONS,
  MARITAL_STATUS_OPTIONS,
} from "@/lib/patients/constants";
import { searchPatients } from "@/lib/patients/store";
import { startPerf, endPerf } from "@/lib/perf";

const PatientSchema = z.object({
  mrn: z.string().min(1),
  full_name: z.string().min(1),
  phone: z.string().optional().nullable(),
  dob: z.string().optional().nullable(),       // "YYYY-MM-DD"
  gender: z.enum(GENDER_OPTIONS).optional().nullable(),
  address: z.string().optional().nullable(),
  allergies: z.string().optional().nullable(),
  blood_group: z.enum(BLOOD_GROUP_OPTIONS).optional().nullable(),
  marital_status: z.enum(MARITAL_STATUS_OPTIONS).optional().nullable(),
  location: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  district: z.string().optional().nullable(),
  relative_name: z.string().optional().nullable(),
  relative_phone: z.string().optional().nullable(),
  occupation: z.string().optional().nullable(),
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
      blood_group: payload.blood_group ?? null,
      marital_status: payload.marital_status ?? null,
      location: payload.location ?? null,
      state: payload.state ?? null,
      country: payload.country ?? null,
      district: payload.district ?? null,
      relative_name: payload.relative_name ?? null,
      relative_phone: payload.relative_phone ?? null,
      occupation: payload.occupation ?? null,
      // created_by is auto-allowed; audit trigger will write a log
    })
    .select("id, mrn, full_name")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, patient: data });
}

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? "25");
  const timer = startPerf(`[perf] patients:api search="${search}" page=${page}`);

  try {
    const result = await searchPatients(search, supabase, { page, pageSize });
    return NextResponse.json({
      patients: result.patients,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    });
  } catch (error) {
    console.error("[patients] search failed", error);
    const message =
      error instanceof Error ? error.message : "Failed to load patients";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    endPerf(timer);
  }
}
