"use client";

import { useEffect, useId, useState } from "react";
import type { NoteTemplate } from "@/lib/clinical-notes/templates";
import { cn } from "@/lib/utils";

type NoteTemplateSelectProps = {
  selectedTemplateId: string | null;
  onTemplateChange(template: NoteTemplate | null): void;
  className?: string;
  hideLabel?: boolean;
};

type TemplateResponse = {
  ok?: boolean;
  templates?: NoteTemplate[];
  error?: string;
};

export function NoteTemplateSelect({
  selectedTemplateId,
  onTemplateChange,
  className,
  hideLabel = false,
}: NoteTemplateSelectProps) {
  const [templates, setTemplates] = useState<NoteTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadTemplates() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/note-templates", {
          credentials: "include",
        });
        const payload: TemplateResponse = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load templates");
        }
        if (mounted) {
          setTemplates(payload.templates ?? []);
        }
      } catch (err) {
        if (mounted) {
          const message = err instanceof Error ? err.message : "Failed to load templates";
          setError(message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }
    loadTemplates();
    return () => {
      mounted = false;
    };
  }, []);

  const selectedId = selectedTemplateId ?? "";
  const hasTemplates = templates.length > 0;
  const labelId = useId();

  return (
    <div className={cn("space-y-1", className)}>
      {!hideLabel && (
        <label
          htmlFor={labelId}
          className="text-sm font-medium text-muted-foreground"
        >
          Templates
        </label>
      )}
      <select
        id={labelId}
        className={cn(
          "field h-10 rounded-xl border border-slate-200 bg-white/95 text-sm text-slate-900 dark:border-white/10 dark:bg-black/30 dark:text-white",
          !hasTemplates && "text-muted-foreground"
        )}
        value={selectedId}
        onChange={(event) => {
          const nextId = event.target.value || null;
          const template =
            templates.find((item) => item.id === nextId) ?? null;
          onTemplateChange(template);
        }}
        disabled={!hasTemplates || loading}
      >
        <option value="">
          {loading
            ? "Loading templates..."
            : hasTemplates
              ? "No template"
              : "No templates available"}
        </option>
        {templates.map((template) => (
          <option key={template.id} value={template.id}>
            {template.name}
            {template.is_default ? " (default)" : ""}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-rose-500">{error}</p>}
    </div>
  );
}
