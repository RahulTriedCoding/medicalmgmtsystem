// app/api/patients/[id]/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ParamsShape = { id?: string } | Promise<{ id?: string }>;

export async function PATCH(request: Request, { params }: { params: ParamsShape }) {
  // params may be a Promise (Next.js dynamic APIs). unwrap it:
  const resolvedParams = await params;
  const id = resolvedParams?.id;

  if (!id) {
    return NextResponse.json({ error: "Missing patient id in URL" }, { status: 400 });
  }

  let parsed: any;
  try {
    parsed = await request.json();
  } catch (err) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // optional: whitelist fields you allow to update
  const updates: Record<string, any> = {};
  const allowed = ["full_name", "phone", "dob", "gender", "address", "allergies"];
  for (const k of allowed) {
    if (k in parsed) updates[k] = parsed[k];
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("patients").update(updates).eq("id", id);

  if (error) {
    // pass DB error message back to client for debugging
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: ParamsShape }) {
  const resolvedParams = await params;
  const id = resolvedParams?.id;

  if (!id) {
    return NextResponse.json({ error: "Missing patient id in URL" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("patients").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
