// app/(app)/patients/page.tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";
import NewPatientButton from "@/components/patients/new-patient";
import EditPatientButton from "@/components/patients/edit-patient";

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
  const patients: Patient[] = (data ?? []).filter(
    (p: any) => typeof p?.id === "string" && p.id.length > 0
  ) as Patient[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Patients</h1>
        <NewPatientButton />
      </div>

      {error ? (
        <div className="text-red-600 text-sm">Error: {error.message}</div>
      ) : !patients.length ? (
        <div className="text-sm text-muted-foreground">No patients found.</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
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
                    <EditPatientButton patient={p} />
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
