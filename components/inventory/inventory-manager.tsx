"use client";

import { useState } from "react";
import { InventoryItem } from "@/lib/inventory/store";

type Props = {
  initialItems: InventoryItem[];
};

type FormState = {
  error: string | null;
  success: string | null;
  loading: boolean;
};

const emptyForm: FormState = {
  error: null,
  success: null,
  loading: false,
};

export function InventoryManager({ initialItems }: Props) {
  const [items, setItems] = useState<InventoryItem[]>(initialItems);
  const [formState, setFormState] = useState<FormState>(emptyForm);

  async function refresh() {
    const res = await fetch("/api/inventory");
    if (!res.ok) return;
    const payload = await res.json();
    setItems(payload.items);
  }

  async function handleAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = {
      name: data.get("name"),
      description: data.get("description") || undefined,
      unit: data.get("unit") || undefined,
      quantity: Number(data.get("quantity") || 0),
      lowStockThreshold: Number(data.get("threshold") || 0),
    };

    setFormState({ error: null, success: null, loading: true });
    const res = await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setFormState({
        error: payload?.error ?? "Failed to add item",
        success: null,
        loading: false,
      });
      return;
    }

    form.reset();
    setFormState({
      error: null,
      success: "Item saved",
      loading: false,
    });
    await refresh();
  }

  async function adjust(itemId: string, delta: number) {
    const res = await fetch("/api/inventory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: itemId, delta }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      alert(payload?.error ?? "Failed to update stock");
      return;
    }
    await refresh();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border p-4">
        <h2 className="text-lg font-semibold mb-3">Add inventory item</h2>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={handleAdd}>
          <label className="text-sm">
            Name *
            <input name="name" required className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
          </label>
          <label className="text-sm">
            Unit
            <input name="unit" className="mt-1 w-full rounded-md border px-3 py-2 text-sm" placeholder="pcs, box..." />
          </label>
          <label className="text-sm">
            Quantity *
            <input
              name="quantity"
              type="number"
              min={0}
              defaultValue={0}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            Low stock threshold
            <input
              name="threshold"
              type="number"
              min={0}
              defaultValue={0}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm md:col-span-2">
            Description
            <textarea
              name="description"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              rows={2}
            />
          </label>
          <div className="md:col-span-2 flex items-center gap-3">
            <button
              disabled={formState.loading}
              className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
            >
              {formState.loading ? "Saving..." : "Save item"}
            </button>
            {formState.error && <p className="text-sm text-red-600">{formState.error}</p>}
            {formState.success && <p className="text-sm text-green-600">{formState.success}</p>}
          </div>
        </form>
      </section>

      <section className="rounded-lg border">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-semibold">Current stock</h2>
          <button className="text-sm underline" onClick={refresh}>
            Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="p-2 text-left">Item</th>
                <th className="p-2 text-left">Description</th>
                <th className="p-2 text-left">Quantity</th>
                <th className="p-2 text-left">Low stock</th>
                <th className="p-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const low = item.lowStockThreshold && item.quantity <= item.lowStockThreshold;
                return (
                  <tr key={item.id} className="border-t">
                    <td className="p-2 font-medium">
                      {item.name}
                      {item.unit ? <span className="text-xs text-muted-foreground ml-1">{item.unit}</span> : null}
                    </td>
                    <td className="p-2 text-muted-foreground">{item.description ?? "—"}</td>
                    <td className="p-2">
                      <span className={low ? "text-red-600 font-semibold" : ""}>{item.quantity}</span>
                    </td>
                    <td className="p-2">{item.lowStockThreshold ?? 0}</td>
                    <td className="p-2">
                      <div className="flex gap-2">
                        <button
                          className="rounded-md border px-2 py-1 text-xs"
                          onClick={() => adjust(item.id, 5)}
                        >
                          +5
                        </button>
                        <button
                          className="rounded-md border px-2 py-1 text-xs"
                          onClick={() => adjust(item.id, 1)}
                        >
                          +1
                        </button>
                        <button
                          className="rounded-md border px-2 py-1 text-xs"
                          onClick={() => adjust(item.id, -1)}
                        >
                          -1
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!items.length && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-muted-foreground">
                    No inventory items yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
