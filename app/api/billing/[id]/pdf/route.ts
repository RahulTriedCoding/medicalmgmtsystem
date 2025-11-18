import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findInvoice } from "@/lib/billing/store";
import { requireStaffRole } from "@/lib/staff/permissions";
import { generateInvoicePdf } from "@/lib/billing/pdf";
import { getSettings } from "@/lib/settings/store";

type ParamsShape = Promise<{ id?: string }>;

const IdSchema = z.object({ id: z.string().uuid() });

async function resolveId(params: ParamsShape) {
  const resolved = await params;
  const parsed = IdSchema.safeParse({ id: resolved?.id ?? "" });
  if (!parsed.success) return null;
  return parsed.data.id;
}

export async function GET(_: Request, { params }: { params: ParamsShape }) {
  const supabase = await createSupabaseServerClient();
  const guard = await requireStaffRole(supabase, ["admin", "receptionist", "doctor"]);
  if ("response" in guard) return guard.response;

  const id = await resolveId(params);
  if (!id) {
    return NextResponse.json({ error: "Invalid invoice id" }, { status: 400 });
  }

  const invoice = await findInvoice(id, supabase);
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const { data: patient } = await supabase
    .from("patients")
    .select("full_name, mrn")
    .eq("id", invoice.patient_id)
    .maybeSingle();

  let clinicName = "Medical MMS";
  let currencyCode = "USD";
  try {
    const settings = await getSettings(supabase);
    clinicName = settings?.clinic_name?.trim() || clinicName;
    currencyCode = settings?.currency || currencyCode;
  } catch (settingsError) {
    console.error("[billing] failed to load settings for invoice PDF", settingsError);
  }

  try {
    const pdfBytes = await generateInvoicePdf({
      invoice,
      patientName: patient?.full_name ?? "Patient",
      patientMrn: patient?.mrn ?? null,
      currencyCode,
      clinicName,
    });

    return new Response(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="invoice-${invoice.invoice_number}.pdf"`,
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[billing] failed to generate invoice PDF", error);
    return NextResponse.json({ error: "Unable to generate PDF" }, { status: 500 });
  }
}
