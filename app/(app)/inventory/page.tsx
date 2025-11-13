import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getInventoryItems } from "@/lib/inventory/store";
import { InventoryManager } from "@/components/inventory/inventory-manager";

export default async function InventoryPage() {
  const supabase = await createSupabaseServerClient();
  const items = await getInventoryItems(supabase);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Inventory</h1>
      <InventoryManager initialItems={items} />
    </div>
  );
}
