import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireStaffRole } from "@/lib/staff/permissions";
import {
  addInventoryItem,
  adjustInventoryQuantity,
  getInventoryItems,
  setInventoryQuantity,
} from "@/lib/inventory/store";

const CreateSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(2),
  description: z.string().trim().max(200).optional(),
  unit: z.string().trim().max(20).optional(),
  quantity: z.number().int().nonnegative().default(0),
  lowStockThreshold: z.number().int().nonnegative().default(0),
});

const UpdateSchema = z.object({
  id: z.string().min(1),
  delta: z.number().int().optional(),
  quantity: z.number().int().nonnegative().optional(),
});

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const guard = await requireStaffRole(supabase, ["admin", "doctor", "receptionist"]);
  if ("response" in guard) return guard.response;

  const items = await getInventoryItems(supabase);
  return NextResponse.json({ ok: true, items });
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const guard = await requireStaffRole(supabase, ["admin", "receptionist"]);
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

  const item = await addInventoryItem(parsed.data, supabase);
  return NextResponse.json({ ok: true, item }, { status: 201 });
}

export async function PATCH(req: Request) {
  const supabase = await createSupabaseServerClient();
  const guard = await requireStaffRole(supabase, ["admin", "receptionist"]);
  if ("response" in guard) return guard.response;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = UpdateSchema.safeParse(payload);
  if (!parsed.success || (!parsed.data.delta && parsed.data.quantity === undefined)) {
    return NextResponse.json({ error: "Provide delta or quantity" }, { status: 400 });
  }

  let item = null;
  if (parsed.data.quantity !== undefined) {
    item = await setInventoryQuantity(parsed.data.id, parsed.data.quantity, supabase);
  } else if (parsed.data.delta !== undefined) {
    item = await adjustInventoryQuantity(parsed.data.id, parsed.data.delta, supabase);
  }

  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, item });
}
