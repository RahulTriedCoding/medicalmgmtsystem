import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  DOCTOR_FIELD_CANDIDATES,
  PATIENT_FIELD_CANDIDATES,
  looksLikeUuid,
  pickRelationValue,
} from "@/lib/prescriptions/helpers";
import NewPrescriptionButton from "@/components/prescriptions/new-prescription";
import { getInventoryItems, InventoryItem } from "@/lib/inventory/store";
import { getPrescriptions, StoredPrescription } from "@/lib/prescriptions/store";

type Option = { id: string; label: string };
type InventoryOption = { id: string; label: string; quantity: number };

function fmtDate(value: string) {
  const dt = new Date(value);
  return dt.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function PrescriptionsPage() {
  const supabase = await createSupabaseServerClient();

  const [patientsResult, doctorsResult, inventoryItems, prescriptions] = await Promise.all([
      supabase.from("patients").select("id, full_name, mrn").order("full_name").limit(200),
      supabase
        .from("users")
        .select("id, full_name, role")
        .eq("role", "doctor")
        .order("full_name")
        .limit(200),
      getInventoryItems(supabase),
      getPrescriptions(supabase),
    ]);

  const patientMap = new Map(
    (patientsResult.data ?? []).map((patient) => [patient.id, patient.full_name ?? "Patient"])
  );

  const doctorMap = new Map(
    (doctorsResult.data ?? []).map((doctor) => [doctor.id, doctor.full_name ?? "Doctor"])
  );

  const patients: Option[] = (patientsResult.data ?? []).map((patient) => ({
    id: patient.id,
    label: patient.mrn ? `${patient.full_name} (${patient.mrn})` : patient.full_name ?? "Patient",
  }));

  const doctors: Option[] = (doctorsResult.data ?? []).map((doctor) => ({
    id: doctor.id,
    label: doctor.full_name ?? "Doctor",
  }));

  const items: InventoryOption[] = inventoryItems.map((row: InventoryItem) => ({
    id: row.id,
    label: row.name,
    quantity: row.quantity,
  }));

  const mappedPrescriptions = prescriptions.map((entry: StoredPrescription) => {
    const patientRef = pickRelationValue(entry as Record<string, unknown>, PATIENT_FIELD_CANDIDATES);
    const doctorRef = pickRelationValue(entry as Record<string, unknown>, DOCTOR_FIELD_CANDIDATES);

    const patientName = patientRef
      ? looksLikeUuid(patientRef)
        ? patientMap.get(patientRef) ?? "Patient"
        : patientRef
      : "Patient";
    const doctorName = doctorRef
      ? looksLikeUuid(doctorRef)
        ? doctorMap.get(doctorRef) ?? "Doctor"
        : doctorRef
      : "Doctor";

    return {
      id: entry.id,
      created_at: entry.created_at,
      notes: entry.notes,
      lines: Array.isArray(entry.lines) ? entry.lines : [],
      patient_name: patientName,
      doctor_name: doctorName,
    };
  });

  const error = patientsResult.error || doctorsResult.error;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Prescriptions</h1>
        <NewPrescriptionButton patients={patients} doctors={doctors} items={items} />
      </div>

      {error ? (
        <div className="text-sm text-red-600">Error: {error.message}</div>
      ) : !mappedPrescriptions.length ? (
        <div className="text-sm text-muted-foreground">No prescriptions yet.</div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="p-2 text-left">Patient</th>
                <th className="p-2 text-left">Doctor</th>
                <th className="p-2 text-left">Created</th>
                <th className="p-2 text-left">Medications</th>
                <th className="p-2 text-left">Notes</th>
              </tr>
            </thead>
            <tbody>
              {mappedPrescriptions.map((prescription) => (
                <tr key={prescription.id} className="border-t">
                  <td className="p-2">{prescription.patient_name}</td>
                  <td className="p-2">{prescription.doctor_name}</td>
                  <td className="p-2">{fmtDate(prescription.created_at)}</td>
                  <td className="p-2">
                    {prescription.lines.map(
                      (line: (typeof prescription.lines)[number], index: number) => (
                      <div key={`${prescription.id}-${index}`}>
                        {(line.name as string | undefined) ?? "Item"} — {line.dosage} × {line.quantity}
                      </div>
                      )
                    )}
                  </td>
                  <td className="p-2">{prescription.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
