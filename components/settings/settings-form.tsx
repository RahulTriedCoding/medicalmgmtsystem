"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { AppSettings } from "@/lib/settings/store";

type Props = {
  initial: AppSettings;
};

export function SettingsForm({ initial }: Props) {
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState(initial);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    const payload = {
      clinic_name: String(data.get("clinic_name") || "").trim(),
      clinic_email: String(data.get("clinic_email") || "").trim(),
      clinic_phone: String(data.get("clinic_phone") || "").trim(),
      clinic_address: String(data.get("clinic_address") || "").trim(),
      currency: String(data.get("currency") || "").trim(),
      timezone: String(data.get("timezone") || "").trim(),
      default_appointment_duration: Number(data.get("default_appointment_duration") || 30),
      enable_email_notifications: data.get("enable_email_notifications") === "on",
      enable_sms_notifications: data.get("enable_sms_notifications") === "on",
      billing_notes: String(data.get("billing_notes") || ""),
    };

    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      toast.error(json?.error ?? "Failed to save settings");
      return;
    }

    const json = await res.json().catch(() => null);
    if (json?.settings) {
      setValues(json.settings as AppSettings);
    }
    toast.success("Settings updated");
  }

  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      <section className="surface p-5 space-y-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Clinic profile</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm text-muted-foreground">
            Clinic name
            <input
              name="clinic_name"
              defaultValue={values.clinic_name}
              className="field mt-1"
              required
            />
          </label>
          <label className="text-sm text-muted-foreground">
            Email
            <input
              name="clinic_email"
              type="email"
              defaultValue={values.clinic_email}
              className="field mt-1"
              required
            />
          </label>
          <label className="text-sm text-muted-foreground">
            Phone number
            <input
              name="clinic_phone"
              defaultValue={values.clinic_phone}
              className="field mt-1"
              required
            />
          </label>
          <label className="text-sm text-muted-foreground md:col-span-2">
            Address
            <textarea
              name="clinic_address"
              defaultValue={values.clinic_address}
              className="field mt-1"
              rows={2}
              required
            />
          </label>
        </div>
      </section>

      <section className="surface p-5 space-y-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Scheduling</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm text-muted-foreground">
            Currency
            <input
              name="currency"
              defaultValue={values.currency}
              className="field mt-1 uppercase"
              required
              maxLength={5}
            />
          </label>
          <label className="text-sm text-muted-foreground">
            Timezone
            <input
              name="timezone"
              defaultValue={values.timezone}
              className="field mt-1"
              required
            />
          </label>
          <label className="text-sm text-muted-foreground">
            Default appointment duration (min)
            <input
              type="number"
              name="default_appointment_duration"
              min={5}
              max={240}
              defaultValue={values.default_appointment_duration}
              className="field mt-1"
              required
            />
          </label>
        </div>
      </section>

      <section className="surface p-5 space-y-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Notifications</h2>
        <label className="flex items-center gap-3 text-sm text-muted-foreground">
          <input
            type="checkbox"
            name="enable_email_notifications"
            defaultChecked={values.enable_email_notifications}
          />
          Email alerts
        </label>
        <label className="flex items-center gap-3 text-sm text-muted-foreground">
          <input
            type="checkbox"
            name="enable_sms_notifications"
            defaultChecked={values.enable_sms_notifications}
          />
          SMS reminders
        </label>
      </section>

      <section className="surface p-5 space-y-2">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Billing notes</h2>
        <textarea
          name="billing_notes"
          defaultValue={values.billing_notes}
          className="field mt-1"
          rows={4}
        />
        <p className="text-xs text-muted-foreground">
          These notes can be referenced when generating invoices or communicating payment terms.
        </p>
      </section>

      <button
        className="btn-primary px-6 py-2.5 text-sm font-semibold disabled:opacity-60"
        disabled={saving}
      >
        {saving ? "Saving..." : "Save settings"}
      </button>
    </form>
  );
}
