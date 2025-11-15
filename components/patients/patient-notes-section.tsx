"use client";

import { useState } from "react";
import { toast } from "sonner";
import { NotebookPen, Pencil } from "lucide-react";
import type { Patient } from "@/lib/patients/types";
import type { ClinicalNote } from "@/lib/clinical-notes/store";

type Props = {
  patient: Patient;
  initialNotes: ClinicalNote[];
  canEdit: boolean;
};

type LocalNote = ClinicalNote;

function formatDate(value?: string | null) {
  if (!value) return "-";
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? value : dt.toLocaleDateString();
}

function formatTimestamp(value?: string | null) {
  if (!value) return "-";
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? value : dt.toLocaleString();
}

export function PatientNotesSection({ patient, initialNotes, canEdit }: Props) {
  const [notes, setNotes] = useState<LocalNote[]>(initialNotes);
  const [noteText, setNoteText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [errorText, setErrorText] = useState<string | null>(null);

  async function reloadAfterCreate(note: LocalNote) {
    setNotes((prev) => [note, ...prev]);
  }

  async function handleCreate() {
    if (!canEdit) return;
    const trimmed = noteText.trim();
    if (!trimmed) {
      setErrorText("Please write a note before saving.");
      return;
    }
    setSubmitting(true);
    setErrorText(null);
    try {
      const response = await fetch(`/api/patients/${patient.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note_text: trimmed }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to save note");
      }
      await reloadAfterCreate(payload.note as LocalNote);
      setNoteText("");
      toast.success("Clinical note saved");
    } catch (error) {
      console.error("[notes] create error", error);
      const message = error instanceof Error ? error.message : "Failed to save note";
      setErrorText(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(note: LocalNote) {
    if (!canEdit) return;
    setEditingId(note.id);
    setEditingText(note.note_text);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingText("");
  }

  async function handleEditSave(noteId: string) {
    if (!canEdit) return;
    const trimmed = editingText.trim();
    if (!trimmed) {
      toast.error("Note text cannot be empty.");
      return;
    }
    try {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note_text: trimmed }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to update note");
      }
      setNotes((prev) =>
        prev.map((note) => (note.id === noteId ? (payload.note as LocalNote) : note))
      );
      toast.success("Note updated");
      cancelEdit();
    } catch (error) {
      console.error("[notes] update error", error);
      const message = error instanceof Error ? error.message : "Failed to update note";
      toast.error(message);
    }
  }

  return (
    <div className="space-y-6" id="notes">
      <section className="surface p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              {patient.full_name}
            </h2>
            <p className="text-sm text-muted-foreground">MRN {patient.mrn}</p>
          </div>
          <div className="grid gap-2 text-sm text-muted-foreground">
            <span>Phone: {patient.phone ?? "—"}</span>
            <span>DOB: {formatDate(patient.dob)}</span>
            <span>Gender: {patient.gender ?? "—"}</span>
          </div>
        </div>
      </section>

      <section className="surface space-y-4 p-5">
        <div className="flex items-center gap-2">
          <NotebookPen className="h-5 w-5 text-primary" />
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Clinical notes
            </h3>
            <p className="text-sm text-muted-foreground">
              View and capture encounter notes for this patient.
            </p>
          </div>
        </div>

        {canEdit ? (
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5">
            <label className="text-sm font-medium text-muted-foreground">
              Add a note
            </label>
            <textarea
              rows={5}
              className="w-full rounded-2xl border border-slate-200 bg-white/95 p-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-white/10 dark:bg-black/30 dark:text-white dark:placeholder:text-white/60"
              value={noteText}
              onChange={(event) => setNoteText(event.target.value)}
              placeholder="Write the clinical note for this patient…"
            />
            {errorText && <p className="text-sm text-rose-500">{errorText}</p>}
            <div className="form-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setNoteText("");
                  setErrorText(null);
                }}
                disabled={submitting}
              >
                Clear
              </button>
              <button
                type="button"
                className="btn-primary disabled:opacity-60"
                onClick={handleCreate}
                disabled={submitting}
              >
                {submitting ? "Saving…" : "Save note"}
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-300/30 dark:bg-amber-500/10 dark:text-amber-100">
            You have read-only access to patient notes.
          </div>
        )}

        <div className="space-y-3">
          {notes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-center text-sm text-muted-foreground dark:border-white/20">
              No notes recorded for this patient yet.
            </div>
          ) : (
            notes.map((note) => (
              <article
                key={note.id}
                className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm dark:border-white/10 dark:bg-white/5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {note.doctor_name ?? "Clinician"} • {formatTimestamp(note.created_at)}
                  </span>
                  {note.appointment_starts_at && (
                    <span>
                      Linked to appointment {formatTimestamp(note.appointment_starts_at)}
                    </span>
                  )}
                </div>
                {editingId === note.id ? (
                  <div className="mt-3 space-y-3">
                    <textarea
                      className="w-full rounded-xl border border-slate-300 bg-white/80 p-3 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-white/20 dark:bg-black/30 dark:text-white"
                      rows={4}
                      value={editingText}
                      onChange={(event) => setEditingText(event.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="btn-ghost text-xs"
                        onClick={cancelEdit}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn-primary text-xs"
                        onClick={() => handleEditSave(note.id)}
                      >
                        Save changes
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 whitespace-pre-wrap text-sm text-slate-900 dark:text-white">
                    {note.note_text}
                  </p>
                )}

                {canEdit && editingId !== note.id && (
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80"
                      onClick={() => startEdit(note)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit note
                    </button>
                  </div>
                )}
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
