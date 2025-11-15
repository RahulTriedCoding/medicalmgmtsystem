"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
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
  patientId: string;
  patientName?: string | null;
  patientMrn?: string | null;
  doctorName?: string | null;
  startsAt?: string;
  endsAt?: string;
};

export function AppointmentNotesButton({
  appointmentId,
  patientId,
  patientName,
  patientMrn,
  doctorName,
  startsAt,
  endsAt,
}: AppointmentNotesButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-secondary text-xs px-4 py-2">
        Clinical notes
      </button>
      {open && (
        <NotesDialog
          appointmentId={appointmentId}
          patientId={patientId}
          patientName={patientName}
          patientMrn={patientMrn}
          doctorName={doctorName}
          startsAt={startsAt}
          endsAt={endsAt}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

type NotesDialogProps = AppointmentNotesButtonProps & {
  onClose(): void;
};

function NotesDialog({
  appointmentId,
  patientId,
  patientName,
  patientMrn,
  doctorName,
  startsAt,
  endsAt,
  onClose,
}: NotesDialogProps) {
  const [notes, setNotes] = useState<ClinicalNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [templateKey, setTemplateKey] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

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
      console.error("[clinical notes] load failed", err);
      setError(err instanceof Error ? err.message : "Unable to load notes");
    } finally {
      setLoading(false);
    }
  }, [appointmentId]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

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
        console.error("[clinical notes] save failed", payload);
        throw new Error(payload?.error ?? "Failed to save note");
      }
      setNotes(payload.notes ?? []);
      setNoteText("");
      setTemplateKey(null);
      toast.success("Clinical note saved");
      onClose();
    } catch (err) {
      console.error("[clinical notes] save failed", err);
      toast.error(err instanceof Error ? err.message : "Failed to save note");
    } finally {
      setSubmitting(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center px-4 py-6 backdrop-blur">
      <div className="modal-card flex w-full max-w-4xl flex-col p-6 text-foreground dark:text-white max-h-[92vh]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-widest text-cyan-600/70 dark:text-cyan-300/70">Appointment</p>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Clinical notes</h2>
            <p className="text-sm text-muted-foreground">
              {patientName ?? "Patient"} {patientMrn ? `(${patientMrn})` : ""} · {doctorName ?? "Doctor"}
            </p>
            {(startsAt || endsAt) && (
              <p className="text-xs text-muted-foreground">
                {startsAt ? new Date(startsAt).toLocaleString() : ""}{" "}
                {endsAt ? `– ${new Date(endsAt).toLocaleString()}` : ""}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <Link href={`/patients/${patientId}/notes`} className="btn-secondary text-xs">
              Open patient notes
            </Link>
            <button className="btn-ghost text-xs" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className="mt-6 flex-1 min-h-0">
          <div className="grid h-full gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
            <div className="flex min-h-0 flex-col gap-4">
              <div className="modal-panel space-y-3 p-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Add clinical note</p>
                  <p className="text-xs text-muted-foreground">
                    Use a template or compose from scratch. Notes sync to Supabase for the entire care team.
                  </p>
                </div>
                <label className="text-sm font-medium text-muted-foreground">Template (optional)</label>
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

              <div className="modal-panel flex min-h-[260px] flex-1 flex-col space-y-3 p-4">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-medium text-muted-foreground">Clinical notes</label>
                  <p className="text-xs text-muted-foreground">SOAP, assessment, plan, instructions...</p>
                </div>
                <textarea
                  className="field flex-1 resize-y"
                  value={noteText}
                  placeholder="Write clinical notes (SOAP, assessment, plan, etc.)…"
                  onChange={(event) => setNoteText(event.target.value)}
                />
              </div>

              <div className="form-actions modal-panel shrink-0 p-4">
                <button type="button" className="btn-secondary" onClick={onClose}>
                  Cancel
                </button>
                <button className="btn-primary disabled:opacity-60" onClick={submitNote} disabled={submitting}>
                  {submitting ? "Saving…" : "Save note"}
                </button>
              </div>
            </div>

            <div className="modal-panel min-h-0 overflow-y-auto p-4">
              <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Previous clinical notes</h3>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : error ? (
                <p className="text-sm text-red-400">{error}</p>
              ) : !notes.length ? (
                <p className="text-sm text-muted-foreground">No clinical notes for this appointment.</p>
              ) : (
                <ul className="space-y-3">
                  {notes.map((note) => (
                    <li key={note.id} className="modal-panel space-y-1 border border-slate-200 p-3 text-sm dark:border-white/10 dark:bg-black/30">
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
    </div>,
    document.body
  );
}
