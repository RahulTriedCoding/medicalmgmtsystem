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
      <button onClick={() => setOpen(true)} className="btn-secondary text-xs">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur">
      <div className="w-full max-w-2xl space-y-4 rounded-3xl border border-white/10 bg-[#080a10] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.65)]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Visit notes</h2>
            <p className="text-sm text-muted-foreground">
              {patientName ?? "Patient"} · {doctorName ?? "Doctor"}
            </p>
          </div>
          <button className="btn-ghost text-xs" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Template</label>
            <select
              className="field"
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
            <label className="text-sm font-medium text-muted-foreground">Note</label>
            <textarea
              className="field h-32"
              value={noteText}
              placeholder="Subjective, assessment, plan..."
              onChange={(event) => setNoteText(event.target.value)}
            />
          </div>

          <button className="btn-primary disabled:opacity-60" onClick={submitNote} disabled={submitting}>
            {submitting ? "Saving..." : "Save note"}
          </button>

          <div className="border-t border-white/10 pt-4">
            <h3 className="mb-2 text-sm font-semibold text-white">Previous notes</h3>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : error ? (
              <p className="text-sm text-red-400">{error}</p>
            ) : !notes.length ? (
              <p className="text-sm text-muted-foreground">No notes for this appointment.</p>
            ) : (
              <ul className="max-h-60 space-y-3 overflow-y-auto pr-2">
                {notes.map((note) => (
                  <li key={note.id} className="space-y-1 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm">
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
