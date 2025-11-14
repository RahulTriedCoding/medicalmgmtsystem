import { randomUUID } from "crypto";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentStaffContext } from "@/lib/staff/current";

export type InventoryItem = {
  id: string;
  name: string;
  description?: string | null;
  unit?: string | null;
  quantity: number;
  lowStockThreshold?: number;
  updated_at: string;
};

type ServerClient = SupabaseClient;

type InventoryRow = {
  id: string;
  name: string;
  description: string | null;
  unit: string | null;
  quantity: number;
  low_stock_threshold: number | null;
  updated_at: string;
};

type InventoryQuantityRow = {
  id: string;
  name: string;
  quantity: number;
};

async function ensureClient(client?: ServerClient) {
  return client ?? (await createSupabaseServerClient());
}

function isSchemaMissing(error?: PostgrestError | null) {
  if (!error) return false;
  const message = error.message ?? "";
  return (
    error.code === "42P01" ||
    error.code === "42703" ||
    /does not exist/i.test(message)
  );
}

function mapItem(row: InventoryRow): InventoryItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    unit: row.unit ?? null,
    quantity: Number(row.quantity ?? 0),
    lowStockThreshold: Number(row.low_stock_threshold ?? 0),
    updated_at: row.updated_at,
  };
}

export async function getInventoryItems(
  client?: ServerClient
): Promise<InventoryItem[]> {
  const supabase = await ensureClient(client);
  const { data, error } = await supabase
    .from("inventory_items")
    .select<InventoryRow>("id, name, description, unit, quantity, low_stock_threshold, updated_at")
    .order("name", { ascending: true });

  if (error) {
    if (isSchemaMissing(error)) {
      throw new Error("Inventory tables are missing from the Supabase project.");
    }
    throw new Error(error.message);
  }

  const rows = (data ?? []) as InventoryRow[];
  return rows.map(mapItem);
}

export type InventoryUpsertPayload = {
  id?: string;
  name: string;
  description?: string;
  unit?: string;
  quantity: number;
  lowStockThreshold?: number;
};

export async function addInventoryItem(
  payload: InventoryUpsertPayload,
  client?: ServerClient
): Promise<InventoryItem> {
  const supabase = await ensureClient(client);
  const { staffId } = await getCurrentStaffContext(supabase);
  const record = {
    id: payload.id ?? undefined,
    name: payload.name.trim(),
    description: payload.description?.trim() || null,
    unit: payload.unit?.trim() || null,
    quantity: Math.max(0, Number(payload.quantity) || 0),
    low_stock_threshold: Math.max(0, Number(payload.lowStockThreshold) || 0),
    updated_by: staffId,
  };

  const { data, error } = await supabase
    .from("inventory_items")
    .upsert(record, { onConflict: "id" })
    .select("id, name, description, unit, quantity, low_stock_threshold, updated_at")
    .single();

  if (error) {
    if (isSchemaMissing(error)) {
      throw new Error("Inventory tables are missing from the Supabase project.");
    }
    throw new Error(error.message);
  }

  return mapItem(data);
}

async function fetchInventoryItem(
  itemId: string,
  supabase: ServerClient
): Promise<InventoryItem | null> {
  const { data, error } = await supabase
    .from("inventory_items")
    .select<InventoryRow>("id, name, description, unit, quantity, low_stock_threshold, updated_at")
    .eq("id", itemId)
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST116" || isSchemaMissing(error)) {
      return null;
    }
    throw new Error(error.message);
  }
  return data ? mapItem(data as InventoryRow) : null;
}

export async function adjustInventoryQuantity(
  itemId: string,
  delta: number,
  client?: ServerClient
): Promise<InventoryItem | null> {
  const supabase = await ensureClient(client);
  const existing = await fetchInventoryItem(itemId, supabase);
  if (!existing) return null;
  const nextQuantity = Math.max(0, existing.quantity + delta);
  const { staffId } = await getCurrentStaffContext(supabase);

  const { data, error } = await supabase
    .from("inventory_items")
    .update({
      quantity: nextQuantity,
      updated_by: staffId,
    })
    .eq("id", itemId)
    .select("id, name, description, unit, quantity, low_stock_threshold, updated_at")
    .single();

  if (error) {
    if (isSchemaMissing(error)) {
      throw new Error("Inventory tables are missing from the Supabase project.");
    }
    throw new Error(error.message);
  }

  const { error: adjustmentError } = await supabase.from("inventory_adjustments").insert({
    id: randomUUID(),
    item_id: itemId,
    delta,
    created_by: staffId,
  });

  if (adjustmentError) {
    if (isSchemaMissing(adjustmentError)) {
      throw new Error("Inventory tables are missing from the Supabase project.");
    }
    throw new Error(adjustmentError.message);
  }

  return mapItem(data);
}

export async function setInventoryQuantity(
  itemId: string,
  quantity: number,
  client?: ServerClient
): Promise<InventoryItem | null> {
  const supabase = await ensureClient(client);
  const existing = await fetchInventoryItem(itemId, supabase);
  if (!existing) return null;
  const delta = Math.max(0, quantity) - existing.quantity;
  return adjustInventoryQuantity(itemId, delta, supabase);
}

export type InventoryShortage = {
  item_id: string;
  requested: number;
  available: number;
  name: string;
};

export async function consumeInventory(
  requirements: Array<{ item_id: string; quantity: number }>,
  client?: ServerClient
): Promise<{ shortages: InventoryShortage[] }> {
  if (!requirements.length) return { shortages: [] };

  const supabase = await ensureClient(client);
  const ids = requirements.map((req) => req.item_id);
  const { data, error } = await supabase
    .from("inventory_items")
    .select<InventoryQuantityRow>("id, name, quantity")
    .in("id", ids);

  if (error) {
    if (isSchemaMissing(error)) {
      throw new Error("Inventory tables are missing from the Supabase project.");
    }
    throw new Error(error.message);
  }

  const quantityRows = (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    quantity: Number(row.quantity ?? 0),
  }));
  const map = new Map(quantityRows.map((row) => [row.id, row]));
  const shortages: InventoryShortage[] = [];

  for (const req of requirements) {
    const ref = map.get(req.item_id);
    const available = Number(ref?.quantity ?? 0);
    if (!ref || available < req.quantity) {
      shortages.push({
        item_id: req.item_id,
        requested: req.quantity,
        available,
        name: ref?.name ?? "Unknown item",
      });
    }
  }

  if (shortages.length) {
    return { shortages };
  }

  const { staffId } = await getCurrentStaffContext(supabase);
  for (const req of requirements) {
    const ref = map.get(req.item_id)!;
    const nextQty = Math.max(0, Number(ref.quantity ?? 0) - req.quantity);
    const { error: updateError } = await supabase
      .from("inventory_items")
      .update({ quantity: nextQty, updated_by: staffId })
      .eq("id", req.item_id);

    if (updateError) {
      if (isSchemaMissing(updateError)) {
        throw new Error("Inventory tables are missing from the Supabase project.");
      }
      throw new Error(updateError.message);
    }

    const { error: adjustmentError } = await supabase.from("inventory_adjustments").insert({
      id: randomUUID(),
      item_id: req.item_id,
      delta: -req.quantity,
      note: "Prescription consumption",
      created_by: staffId,
    });

    if (adjustmentError) {
      if (isSchemaMissing(adjustmentError)) {
        throw new Error("Inventory tables are missing from the Supabase project.");
      }
      throw new Error(adjustmentError.message);
    }
  }

  return { shortages: [] };
}
