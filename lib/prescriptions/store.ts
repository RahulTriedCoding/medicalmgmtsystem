import { randomUUID } from "crypto";
import { readJsonFile, writeJsonFile } from "@/lib/storage/json";

const FILE = "prescriptions.json";

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

export async function getPrescriptions(): Promise<StoredPrescription[]> {
  return readJsonFile<StoredPrescription[]>(FILE, []);
}

export async function savePrescriptions(items: StoredPrescription[]) {
  await writeJsonFile(FILE, items);
}

export async function addPrescription(
  payload: Omit<StoredPrescription, "id" | "created_at">
): Promise<StoredPrescription> {
  const current = await getPrescriptions();
  const prescription: StoredPrescription = {
    id: randomUUID(),
    created_at: new Date().toISOString(),
    ...payload,
  };
  current.unshift(prescription);
  await savePrescriptions(current);
  return prescription;
}

export async function deletePrescription(id: string): Promise<boolean> {
  const current = await getPrescriptions();
  const next = current.filter((entry) => entry.id !== id);
  if (next.length === current.length) return false;
  await savePrescriptions(next);
  return true;
}

export async function findPrescription(id: string): Promise<StoredPrescription | null> {
  const current = await getPrescriptions();
  return current.find((entry) => entry.id === id) ?? null;
}
