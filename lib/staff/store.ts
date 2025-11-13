import { readJsonFile, writeJsonFile } from "@/lib/storage/json";

const FILE = "staff-directory.json";

export type StaffContact = {
  id: string;
  phone: string | null;
  pending: boolean;
};

export async function getStaffContacts(): Promise<StaffContact[]> {
  const rows = await readJsonFile<StaffContact[]>(FILE, []);
  return rows.map((row) => ({
    id: row.id,
    phone: row.phone ?? null,
    pending: typeof row.pending === "boolean" ? row.pending : false,
  }));
}

async function saveContacts(contacts: StaffContact[]) {
  await writeJsonFile(FILE, contacts);
}

function normalizePhone(phone?: string | null) {
  if (phone === undefined) return undefined;
  if (!phone) return null;
  const trimmed = phone.trim();
  return trimmed.length ? trimmed : null;
}

export async function upsertStaffContact(
  id: string,
  phone?: string | null,
  pending?: boolean
) {
  const contacts = await getStaffContacts();
  const idx = contacts.findIndex((contact) => contact.id === id);
  const normalizedPhone = normalizePhone(phone);
  const nextEntry: StaffContact = {
    id,
    phone:
      normalizedPhone !== undefined
        ? normalizedPhone
        : contacts[idx]?.phone ?? null,
    pending: pending ?? contacts[idx]?.pending ?? false,
  };

  if (idx >= 0) {
    contacts[idx] = nextEntry;
  } else {
    contacts.push(nextEntry);
  }

  await saveContacts(contacts);
}

export async function deleteStaffContact(id: string) {
  const contacts = await getStaffContacts();
  const next = contacts.filter((contact) => contact.id !== id);
  if (next.length === contacts.length) return;
  await saveContacts(next);
}
