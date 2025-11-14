// app/(app)/patients/page.tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";
import NewPatientButton from "@/components/patients/new-patient";
import EditPatientButton from "@/components/patients/edit-patient";
import { PatientNotesButton } from "@/components/notes/patient-notes";

type Patient = {
  id: string;
  mrn: string;
  full_name: string;
  phone?: string | null;
  dob?: string | null;
  gender?: "male" | "female" | "other" | null;
  address?: string | null;
  allergies?: string | null;
};

function isPatientRow(row: unknown): row is Patient {
  if (!row || typeof row !== "object") return false;
  const candidate = row as { id?: unknown };
  return typeof candidate.id === "string" && candidate.id.length > 0;
}

function fmtDate(d?: string | null) {
  if (!d) return "-";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString();
}

export default async function PatientsPage() {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("patients")
    .select("id, mrn, full_name, phone, dob, gender, address, allergies")
    .order("full_name")
    .limit(100);

  // Ensure we only render rows with a valid UUID id
  const patients: Patient[] = (data ?? []).filter(isPatientRow);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Patients</h1>
        <NewPatientButton />
      </div>

      {error ? (
        <div className="text-sm text-red-400">Error: {error.message}</div>
      ) : !patients.length ? (
        <div className="text-sm text-muted-foreground">No patients found.</div>
      ) : (
        <div className="surface border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-2">MRN</th>
                <th className="text-left p-2">Name</th>
                <th className="text-left p-2">Phone</th>
                <th className="text-left p-2">DOB</th>
                <th className="text-left p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="p-2">{p.mrn}</td>
                  <td className="p-2">{p.full_name}</td>
                  <td className="p-2">{p.phone ?? "-"}</td>
                  <td className="p-2">{fmtDate(p.dob)}</td>
                  <td className="p-2">
                    <div className="flex gap-2 flex-wrap">
                      <EditPatientButton patient={p} />
                      <PatientNotesButton patientId={p.id} patientName={p.full_name} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
