import { randomUUID } from "crypto";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentStaffContext } from "@/lib/staff/current";

export type PrescriptionLine = {
  item_id: string;
  name: string;
  dosage: string;
  quantity: number;
};

export type StoredPrescription = {
  id: string;
  patient_id: string;
  doctor_id: string;
  notes: string | null;
  lines: PrescriptionLine[];
  created_at: string;
};

type ServerClient = SupabaseClient;

type PrescriptionLineRow = {
  inventory_item_id: string | null;
  name: string | null;
  dosage: string;
  quantity: number;
};

type PrescriptionRow = {
  id: string;
  patient_id: string;
  doctor_id: string;
  notes: string | null;
  created_at: string;
  lines?: PrescriptionLineRow[] | null;
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
    /relationship.*not found/i.test(message) ||
    /does not exist/i.test(message)
  );
}

function handleError(error: PostgrestError): never {
  if (isSchemaMissing(error)) {
    throw new Error("Prescriptions tables are missing. Ask an admin to run the latest Supabase migrations.");
  }
  throw new Error(error.message);
}

function mapPrescription(row: PrescriptionRow): StoredPrescription {
  return {
    id: row.id,
    patient_id: row.patient_id,
    doctor_id: row.doctor_id,
    notes: row.notes ?? null,
    created_at: row.created_at,
    lines: (row.lines ?? []).map((line) => ({
      item_id: line.inventory_item_id ?? "",
      name: line.name ?? "Item",
      dosage: line.dosage,
      quantity: Number(line.quantity ?? 0),
    })),
  };
}

export async function getPrescriptions(
  client?: ServerClient
): Promise<StoredPrescription[]> {
  const supabase = await ensureClient(client);
  const { data, error } = await supabase
    .from("prescriptions")
    .select(
      `
        id,
        patient_id,
        doctor_id,
        notes,
        created_at,
        lines:prescription_lines (
          id,
          inventory_item_id,
          name,
          dosage,
          quantity
        )
      `
    )
    .order("created_at", { ascending: false });

  if (error) {
    if (isSchemaMissing(error)) {
      console.warn("[prescriptions] clinical tables missing. Returning empty list.");
      return [];
    }
    handleError(error);
  }

  const rows = (data ?? []) as PrescriptionRow[];
  return rows.map(mapPrescription);
}

export async function addPrescription(
  payload: Omit<StoredPrescription, "id" | "created_at">,
  client?: ServerClient
): Promise<StoredPrescription> {
  const supabase = await ensureClient(client);
  const { staffId } = await getCurrentStaffContext(supabase);

  const { data: inserted, error } = await supabase
    .from("prescriptions")
    .insert({
      patient_id: payload.patient_id,
      doctor_id: payload.doctor_id,
      notes: payload.notes?.trim() ? payload.notes.trim() : null,
      created_by: staffId,
    })
    .select("id, created_at, patient_id, doctor_id, notes")
    .single();

  if (error) {
    if (isSchemaMissing(error)) {
      throw new Error("Prescriptions tables are missing. Ask an admin to run the latest Supabase migrations.");
    }
    handleError(error);
  }

  const prescriptionId = inserted.id as string;
  const linesPayload = payload.lines.map((line) => ({
    id: randomUUID(),
    prescription_id: prescriptionId,
    inventory_item_id: line.item_id || null,
    name: line.name ?? "Item",
    dosage: line.dosage,
    quantity: line.quantity,
  }));

  if (linesPayload.length) {
    const { error: lineError } = await supabase.from("prescription_lines").insert(linesPayload);
    if (lineError) {
      if (isSchemaMissing(lineError)) {
        throw new Error("Prescriptions tables are missing. Ask an admin to run the latest Supabase migrations.");
      }
      handleError(lineError);
    }
  }

  const full = await findPrescription(prescriptionId, supabase);
  if (!full) {
    throw new Error("Prescription not found after creation");
  }
  return full;
}

export async function deletePrescription(
  id: string,
  client?: ServerClient
): Promise<boolean> {
  const supabase = await ensureClient(client);
  const { error, count } = await supabase
    .from("prescriptions")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) {
    if (isSchemaMissing(error)) {
      return false;
    }
    handleError(error);
  }

  return !!count;
}

export async function findPrescription(
  id: string,
  client?: ServerClient
): Promise<StoredPrescription | null> {
  const supabase = await ensureClient(client);
  const { data, error } = await supabase
    .from("prescriptions")
    .select(
      `
        id,
        patient_id,
        doctor_id,
        notes,
        created_at,
        lines:prescription_lines (
          id,
          inventory_item_id,
          name,
          dosage,
          quantity
        )
      `
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    if (isSchemaMissing(error)) {
      return null;
    }
    handleError(error);
  }

  if (!data) return null;
  return mapPrescription(data as PrescriptionRow);
}
