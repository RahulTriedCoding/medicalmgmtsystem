import { getInventoryItems } from "@/lib/inventory/store";
import { InventoryManager } from "@/components/inventory/inventory-manager";

export default async function InventoryPage() {
  const items = await getInventoryItems();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Inventory</h1>
      <InventoryManager initialItems={items} />
    </div>
  );
}
