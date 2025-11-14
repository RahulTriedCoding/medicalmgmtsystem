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
      <h1 className="text-xl font-semibold">Inventory</h1>
      {warning ? (
        <div className="rounded-md border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm text-yellow-900">
          {warning}
        </div>
      ) : null}
      <InventoryManager initialItems={items} />
    </div>
  );
}
