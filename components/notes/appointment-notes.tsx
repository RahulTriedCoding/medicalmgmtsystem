"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type ClinicalNote = {
  id: string;
  doctor_name: string | null;
  note_text: string;
  template_key: string | null;
  created_at: string;
};

const TEMPLATES: Array<{ key: string; label: string; text: string }> = [
  {
    key: "general_consult",
    label: "General consult",
    text: "Subjective:\nObjective:\nAssessment:\nPlan:\n",
  },
  {
    key: "follow_up",
    label: "Follow-up",
    text: "Interval history:\nFindings:\nPlan:\n",
  },
  {
    key: "telehealth",
    label: "Telehealth",
    text: "Mode: video/audio\nSubjective:\nAssessment:\nPlan:\n",
  },
];

type AppointmentNotesButtonProps = {
  appointmentId: string;
  patientName?: string | null;
  doctorName?: string | null;
};

export function AppointmentNotesButton({
  appointmentId,
  patientName,
  doctorName,
}: AppointmentNotesButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border px-2 py-1 text-xs"
      >
        Notes
      </button>
      {open && (
        <NotesDialog
          appointmentId={appointmentId}
          patientName={patientName}
          doctorName={doctorName}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

type NotesDialogProps = AppointmentNotesButtonProps & {
  onClose(): void;
};

function NotesDialog({ appointmentId, patientName, doctorName, onClose }: NotesDialogProps) {
  const [notes, setNotes] = useState<ClinicalNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [templateKey, setTemplateKey] = useState<string | null>(null);

  const loadNotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/appointments/${appointmentId}/notes`);
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error ?? "Unable to load notes");
      }
      setNotes(payload.notes ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load notes");
    } finally {
      setLoading(false);
    }
  }, [appointmentId]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  async function submitNote() {
    if (!noteText.trim()) {
      toast.error("Note text is required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/appointments/${appointmentId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note_text: noteText, template_key: templateKey }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error ?? "Failed to save note");
      }
      setNotes(payload.notes ?? []);
      setNoteText("");
      setTemplateKey(null);
      toast.success("Note saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save note");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="w-full max-w-2xl rounded-lg border bg-background p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Visit notes</h2>
            <p className="text-sm text-muted-foreground">
              {patientName ?? "Patient"} · {doctorName ?? "Doctor"}
            </p>
          </div>
          <button className="rounded-md border px-2 py-1 text-sm" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Template</label>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={templateKey ?? ""}
              onChange={(event) => {
                const nextKey = event.target.value || null;
                setTemplateKey(nextKey);
                if (nextKey) {
                  const template = TEMPLATES.find((t) => t.key === nextKey);
                  if (template) {
                    setNoteText((prev) => (prev.trim().length ? prev : template.text));
                  }
                }
              }}
            >
              <option value="">No template</option>
              {TEMPLATES.map((template) => (
                <option key={template.key} value={template.key}>
                  {template.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Note</label>
            <textarea
              className="h-32 w-full rounded-md border px-3 py-2 text-sm"
              value={noteText}
              placeholder="Subjective, assessment, plan..."
              onChange={(event) => setNoteText(event.target.value)}
            />
          </div>

          <button
            className="rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-50"
            onClick={submitNote}
            disabled={submitting}
          >
            {submitting ? "Saving..." : "Save note"}
          </button>

          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold mb-2">Previous notes</h3>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : !notes.length ? (
              <p className="text-sm text-muted-foreground">No notes for this appointment.</p>
            ) : (
              <ul className="space-y-3 max-h-60 overflow-y-auto pr-2">
                {notes.map((note) => (
                  <li key={note.id} className="rounded-md border p-3 text-sm space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{note.doctor_name ?? "Doctor"}</span>
                      <span>{new Date(note.created_at).toLocaleString()}</span>
                    </div>
                    <pre className="whitespace-pre-wrap font-sans text-sm">{note.note_text}</pre>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
