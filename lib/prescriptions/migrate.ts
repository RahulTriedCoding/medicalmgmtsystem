import type { SupabaseClient } from "@supabase/supabase-js";
import { readJsonFile } from "@/lib/storage/json";
import type { StoredPrescription } from "@/lib/prescriptions/store";

const LEGACY_FILE = "prescriptions.json";

export type PrescriptionsMigrationResult = {
  total: number;
  migrated: number;
  skipped: Array<{ id: string; reason: string }>;
};

export async function migrateLegacyPrescriptions(options: {
  supabase: SupabaseClient;
}): Promise<PrescriptionsMigrationResult> {
  const { supabase } = options;
  const prescriptions = await readJsonFile<StoredPrescription[]>(LEGACY_FILE, []);

  const result: PrescriptionsMigrationResult = {
    total: prescriptions.length,
    migrated: 0,
    skipped: [],
  };

  for (const prescription of prescriptions) {
    const { data: existing } = await supabase
      .from("prescriptions")
      .select("id")
      .eq("id", prescription.id)
      .maybeSingle();

    if (existing) {
      continue;
    }

    const { error: insertError } = await supabase.from("prescriptions").insert({
      id: prescription.id,
      patient_id: prescription.patient_id,
      doctor_id: prescription.doctor_id,
      notes: prescription.notes,
      created_at: prescription.created_at,
    });

    if (insertError) {
      result.skipped.push({ id: prescription.id, reason: insertError.message });
      continue;
    }

    const lines = (prescription.lines ?? []).map((line) => ({
      prescription_id: prescription.id,
      inventory_item_id: line.item_id || null,
      name: line.name,
      dosage: line.dosage,
      quantity: line.quantity,
    }));

    if (lines.length) {
      const { error: lineError } = await supabase.from("prescription_lines").insert(lines);
      if (lineError) {
        result.skipped.push({ id: prescription.id, reason: lineError.message });
        await supabase.from("prescriptions").delete().eq("id", prescription.id);
        continue;
      }
    }

    result.migrated += 1;
  }

  return result;
}
