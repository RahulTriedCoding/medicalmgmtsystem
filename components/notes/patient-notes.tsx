"use client";

import { useEffect, useState } from "react";

type ClinicalNote = {
  id: string;
  appointment_id: string;
  doctor_name: string | null;
  created_at: string;
  note_text: string;
};

type PatientNotesButtonProps = {
  patientId: string;
  patientName?: string | null;
};

export function PatientNotesButton({ patientId, patientName }: PatientNotesButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="rounded-md border px-2 py-1 text-xs" onClick={() => setOpen(true)}>
        Notes
      </button>
      {open && (
        <PatientNotesDialog patientId={patientId} patientName={patientName} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

type PatientNotesDialogProps = PatientNotesButtonProps & {
  onClose(): void;
};

function PatientNotesDialog({ patientId, patientName, onClose }: PatientNotesDialogProps) {
  const [notes, setNotes] = useState<ClinicalNote[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setError(null);
      setLoading(true);
      try {
        const res = await fetch(`/api/patients/${patientId}/notes`);
        const payload = await res.json();
        if (!res.ok) {
          throw new Error(payload?.error ?? "Failed to load notes");
        }
        setNotes(payload.notes ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load notes");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [patientId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="w-full max-w-2xl rounded-lg border bg-background p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Notes for {patientName ?? "patient"}</h2>
            <p className="text-sm text-muted-foreground">Includes all appointment notes you can access.</p>
          </div>
          <button className="rounded-md border px-2 py-1 text-sm" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="mt-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : !notes.length ? (
            <p className="text-sm text-muted-foreground">No notes available.</p>
          ) : (
            <ul className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {notes.map((note) => (
                <li key={note.id} className="rounded-md border p-3 text-sm space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{note.doctor_name ?? "Doctor"}</span>
                    <span>{new Date(note.created_at).toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Appointment #{note.appointment_id.slice(0, 8)}
                  </div>
                  <pre className="whitespace-pre-wrap font-sans text-sm">{note.note_text}</pre>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
