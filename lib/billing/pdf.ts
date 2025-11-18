import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { BillingInvoice } from "@/lib/billing/store";
import { formatMoneyForPdf, normalizeCurrencyCode } from "@/lib/currency";

type PdfOptions = {
  invoice: BillingInvoice;
  patientName: string;
  patientMrn?: string | null;
  clinicName?: string;
  clinicAddress?: string | null;
  currencyCode?: string | null;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const LINE_HEIGHT = 16;
const HEADER_GAP = 24;
const SECTION_GAP = 18;
const TABLE_HEADER_GAP = 14;
const ROW_PADDING_Y = 6;
const MULTILINE_SPACING = 14;
const ROW_SEPARATOR = 6;
const SMALL_TEXT = 10;
const BASE_TEXT = 11;
const HEADING_TEXT = 14;

function formatDate(value: string) {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(value: string) {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function wrapText({
  font,
  text,
  maxWidth,
  size,
}: {
  font: PDFFont;
  text: string;
  maxWidth: number;
  size: number;
}) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  words.forEach((word) => {
    const tentative = current ? `${current} ${word}` : word;
    const width = font.widthOfTextAtSize(tentative, size);
    if (width <= maxWidth) {
      current = tentative;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  });
  if (current) lines.push(current);
  return lines;
}

export async function generateInvoicePdf({
  invoice,
  patientName,
  patientMrn,
  clinicName = "Medical MMS",
  clinicAddress,
  currencyCode,
}: PdfOptions): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const normalizedCurrency = normalizeCurrencyCode(currencyCode);
  const formatCurrency = (value: number) => formatMoneyForPdf(value, normalizedCurrency);
  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let cursorY = PAGE_HEIGHT - MARGIN;

  const accent = rgb(0.129, 0.588, 0.564);
  const textColor = rgb(0.12, 0.15, 0.2);
  const subtleColor = rgb(0.55, 0.58, 0.65);

  const ensureSpace = (required: number) => {
    if (cursorY - required < MARGIN) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      cursorY = PAGE_HEIGHT - MARGIN;
      return true;
    }
    return false;
  };

  const drawLine = (options: { thickness?: number; color?: ReturnType<typeof rgb> }) => {
    page.drawLine({
      start: { x: MARGIN, y: cursorY },
      end: { x: PAGE_WIDTH - MARGIN, y: cursorY },
      thickness: options.thickness ?? 0.5,
      color: options.color ?? subtleColor,
    });
  };

  const drawText = ({
    text,
    size = BASE_TEXT,
    font = regular,
    color = textColor,
    x = MARGIN,
    lineGap = LINE_HEIGHT,
  }: {
    text: string;
    size?: number;
    font?: typeof regular;
    color?: ReturnType<typeof rgb>;
    x?: number;
    lineGap?: number;
  }) => {
    ensureSpace(lineGap);
    page.drawText(text, { x, y: cursorY, size, font, color });
    cursorY -= lineGap;
  };

  // Header
  drawText({ text: clinicName, size: 22, font: bold, color: accent, lineGap: LINE_HEIGHT });
  if (clinicAddress) {
    drawText({ text: clinicAddress, size: SMALL_TEXT, color: subtleColor });
  }
  cursorY -= 6;
  drawText({ text: "Invoice", size: 28, font: bold, lineGap: HEADER_GAP });
  drawLine({ thickness: 1, color: accent });
  cursorY -= SECTION_GAP;

  // Invoice metadata
  drawText({ text: `Invoice #: ${invoice.invoice_number}`, size: HEADING_TEXT, font: bold });
  drawText({ text: `Invoice date: ${formatDate(invoice.created_at)}` });
  drawText({ text: `Due date: ${formatDate(invoice.due_date)}` });
  drawText({ text: `Status: ${invoice.status.toUpperCase()}` });

  cursorY -= 8;
  drawText({ text: "Bill to", size: HEADING_TEXT, font: bold });
  drawText({ text: patientName });
  if (patientMrn) drawText({ text: `MRN: ${patientMrn}` });
  cursorY -= SECTION_GAP / 2;
  drawLine({ thickness: 0.6 });
  cursorY -= SECTION_GAP;

  // Items table
  const descriptionColumn = MARGIN;
  const qtyColumn = MARGIN + 260;
  const unitColumn = MARGIN + 330;
  const totalColumn = MARGIN + 430;
  const itemWidth = qtyColumn - descriptionColumn - 12;

  const drawTableHeader = () => {
    ensureSpace(TABLE_HEADER_GAP + LINE_HEIGHT);
    page.drawText("Item", { x: descriptionColumn, y: cursorY, size: BASE_TEXT, font: bold });
    page.drawText("Qty", { x: qtyColumn, y: cursorY, size: BASE_TEXT, font: bold });
    page.drawText("Unit price", { x: unitColumn, y: cursorY, size: BASE_TEXT, font: bold });
    page.drawText("Subtotal", { x: totalColumn, y: cursorY, size: BASE_TEXT, font: bold });
    cursorY -= TABLE_HEADER_GAP;
    drawLine({ thickness: 0.4 });
    cursorY -= ROW_SEPARATOR;
  };

  const lineItems = invoice.line_items ?? [];
  drawTableHeader();

  if (!lineItems.length) {
    drawText({ text: "No line items recorded", x: descriptionColumn });
  } else {
    for (const line of lineItems) {
      const descriptionLines = wrapText({
        font: regular,
        text: line.description?.trim() || "Item",
        maxWidth: itemWidth,
        size: BASE_TEXT,
      });
      const lineCount = Math.max(descriptionLines.length, 1);
      const rowHeight = ROW_PADDING_Y * 2 + lineCount * MULTILINE_SPACING;
      if (ensureSpace(rowHeight + ROW_SEPARATOR)) {
        drawTableHeader();
      }

      let textY = cursorY - ROW_PADDING_Y - BASE_TEXT;
      descriptionLines.forEach((descLine) => {
        page.drawText(descLine, {
          x: descriptionColumn,
          y: textY,
          size: BASE_TEXT,
          font: regular,
          color: textColor,
        });
        textY -= MULTILINE_SPACING;
      });

      const numericBaseline = cursorY - ROW_PADDING_Y - BASE_TEXT;
      page.drawText(String(line.quantity ?? 0), {
        x: qtyColumn,
        y: numericBaseline,
        size: BASE_TEXT,
        font: regular,
      });
      page.drawText(formatCurrency(line.unit_price ?? 0), {
        x: unitColumn,
        y: numericBaseline,
        size: BASE_TEXT,
        font: regular,
      });
      page.drawText(formatCurrency((line.quantity ?? 0) * (line.unit_price ?? 0)), {
        x: totalColumn,
        y: numericBaseline,
        size: BASE_TEXT,
        font: regular,
      });

      cursorY -= rowHeight;
      drawLine({ thickness: 0.35 });
      cursorY -= ROW_SEPARATOR;
    }
  }

  cursorY -= SECTION_GAP / 2;
  drawLine({ thickness: 0.4 });
  cursorY -= SECTION_GAP;

  // Totals block
  const totalsX = PAGE_WIDTH - MARGIN - 180;
  const drawTotalLine = (label: string, value: string, boldLine = false) => {
    ensureSpace(LINE_HEIGHT);
    page.drawText(label, {
      x: totalsX,
      y: cursorY,
      size: BASE_TEXT,
      font: boldLine ? bold : regular,
      color: textColor,
    });
    page.drawText(value, {
      x: totalsX + 100,
      y: cursorY,
      size: BASE_TEXT,
      font: boldLine ? bold : regular,
      color: textColor,
    });
    cursorY -= LINE_HEIGHT;
  };

  drawTotalLine("Subtotal", formatCurrency(invoice.total), true);
  drawTotalLine("Collected", formatCurrency(invoice.total - invoice.balance));
  drawTotalLine("Balance", formatCurrency(invoice.balance), true);

  // Payments section
  if (invoice.payments?.length) {
    cursorY -= SECTION_GAP;
    drawText({ text: "Payments applied", size: HEADING_TEXT, font: bold });
    const paymentCols = [MARGIN, MARGIN + 160, MARGIN + 280, MARGIN + 400];
    const drawPaymentHeader = () => {
      ensureSpace(TABLE_HEADER_GAP);
      ["Date", "Method", "Reference", "Amount"].forEach((label, index) => {
        page.drawText(label, {
          x: paymentCols[index],
          y: cursorY,
          size: SMALL_TEXT,
          font: bold,
        });
      });
      cursorY -= TABLE_HEADER_GAP;
      drawLine({ thickness: 0.4 });
      cursorY -= ROW_SEPARATOR;
    };

    drawPaymentHeader();

    invoice.payments.forEach((payment) => {
      const rowHeight = ROW_PADDING_Y * 2 + LINE_HEIGHT;
      if (ensureSpace(rowHeight + ROW_SEPARATOR)) {
        drawPaymentHeader();
      }
      const baseline = cursorY - ROW_PADDING_Y - BASE_TEXT;
      const values = [
        formatDateTime(payment.paid_at),
        payment.method ?? "-",
        payment.reference ?? "-",
        formatCurrency(payment.amount ?? 0),
      ];
      values.forEach((value, index) => {
        page.drawText(value, {
          x: paymentCols[index],
          y: baseline,
          size: SMALL_TEXT,
          font: regular,
        });
      });
      cursorY -= rowHeight;
      drawLine({ thickness: 0.3 });
      cursorY -= ROW_SEPARATOR;
    });
  }

  cursorY -= SECTION_GAP;
  drawLine({ thickness: 0.4 });
  cursorY -= SECTION_GAP;

  drawText({ text: "Notes", size: HEADING_TEXT, font: bold });
  const notes = invoice.notes?.trim() ? invoice.notes.trim() : "No additional notes.";
  const noteLines = wrapText({
    font: regular,
    text: notes,
    maxWidth: PAGE_WIDTH - MARGIN * 2,
    size: BASE_TEXT,
  });
  noteLines.forEach((line) => {
    drawText({ text: line, size: BASE_TEXT });
  });

  cursorY -= HEADER_GAP;
  drawText({
    text: "Generated by Medical MMS",
    size: SMALL_TEXT,
    color: subtleColor,
  });

  return doc.save();
}
