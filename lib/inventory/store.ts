import { randomUUID } from "crypto";
import { readJsonFile, writeJsonFile } from "@/lib/storage/json";

const INVENTORY_FILE = "inventory.json";

export type InventoryItem = {
  id: string;
  name: string;
  description?: string;
  unit?: string;
  quantity: number;
  lowStockThreshold?: number;
  updated_at: string;
};

export async function getInventoryItems(): Promise<InventoryItem[]> {
  return readJsonFile<InventoryItem[]>(INVENTORY_FILE, []);
}

async function saveInventory(items: InventoryItem[]) {
  await writeJsonFile(INVENTORY_FILE, items);
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
  payload: InventoryUpsertPayload
): Promise<InventoryItem> {
  const items = await getInventoryItems();
  const now = new Date().toISOString();
  const item: InventoryItem = {
    id: payload.id ?? randomUUID(),
    name: payload.name,
    description: payload.description,
    unit: payload.unit,
    quantity: Math.max(0, payload.quantity ?? 0),
    lowStockThreshold: payload.lowStockThreshold ?? 0,
    updated_at: now,
  };

  const existingIndex = items.findIndex((entry) => entry.id === item.id);
  if (existingIndex >= 0) {
    items[existingIndex] = item;
  } else {
    items.push(item);
  }
  await saveInventory(items);
  return item;
}

export async function adjustInventoryQuantity(
  itemId: string,
  delta: number
): Promise<InventoryItem | null> {
  const items = await getInventoryItems();
  const idx = items.findIndex((entry) => entry.id === itemId);
  if (idx === -1) return null;

  const updated = {
    ...items[idx],
    quantity: Math.max(0, items[idx].quantity + delta),
    updated_at: new Date().toISOString(),
  };
  items[idx] = updated;
  await saveInventory(items);
  return updated;
}

export async function setInventoryQuantity(
  itemId: string,
  quantity: number
): Promise<InventoryItem | null> {
  const items = await getInventoryItems();
  const idx = items.findIndex((entry) => entry.id === itemId);
  if (idx === -1) return null;

  const updated = {
    ...items[idx],
    quantity: Math.max(0, quantity),
    updated_at: new Date().toISOString(),
  };
  items[idx] = updated;
  await saveInventory(items);
  return updated;
}

export type InventoryShortage = {
  item_id: string;
  requested: number;
  available: number;
  name: string;
};

export async function consumeInventory(
  requirements: Array<{ item_id: string; quantity: number }>
): Promise<{ shortages: InventoryShortage[] }> {
  if (!requirements.length) return { shortages: [] };

  const items = await getInventoryItems();
  const map = new Map(items.map((item) => [item.id, item]));
  const shortages: InventoryShortage[] = [];

  for (const req of requirements) {
    const ref = map.get(req.item_id);
    const available = ref?.quantity ?? 0;
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

  const now = new Date().toISOString();
  const updated = items.map((item) => {
    const req = requirements.find((line) => line.item_id === item.id);
    if (!req) return item;
    return {
      ...item,
      quantity: Math.max(0, item.quantity - req.quantity),
      updated_at: now,
    };
  });

  await saveInventory(updated);
  return { shortages: [] };
}
