import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getInventoryItems, type InventoryItem } from "@/lib/inventory/store";
import { InventoryManager } from "@/components/inventory/inventory-manager";

export default async function InventoryPage() {
  const supabase = await createSupabaseServerClient();
  let items: InventoryItem[] = [];
  let warning: string | null = null;
  try {
    items = await getInventoryItems(supabase);
  } catch (error) {
    if (error instanceof Error && /inventory tables/i.test(error.message)) {
      warning =
        "Inventory data will appear once the Supabase inventory tables are provisioned and migrated.";
    } else {
      throw error;
    }
  }
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-white">Inventory</h1>
      {warning ? (
        <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {warning}
        </div>
      ) : null}
      <InventoryManager initialItems={items} />
    </div>
  );
}
