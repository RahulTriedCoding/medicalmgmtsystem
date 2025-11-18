export const CURRENCY_MAP = {
  INR: { symbol: "₹", label: "Indian Rupee" },
  USD: { symbol: "$", label: "US Dollar" },
  EUR: { symbol: "€", label: "Euro" },
  GBP: { symbol: "£", label: "British Pound" },
  AED: { symbol: "د.إ", label: "UAE Dirham" },
  AUD: { symbol: "A$", label: "Australian Dollar" },
  CAD: { symbol: "C$", label: "Canadian Dollar" },
  SGD: { symbol: "S$", label: "Singapore Dollar" },
} as const;

export const DEFAULT_CURRENCY_CODE = "USD";

export type CurrencyCode = keyof typeof CURRENCY_MAP;

const formatterCache = new Map<string, Intl.NumberFormat>();

export function normalizeCurrencyCode(code?: string | null): string {
  if (!code || typeof code !== "string") return DEFAULT_CURRENCY_CODE;
  const upper = code.trim().toUpperCase();
  return upper.length ? upper : DEFAULT_CURRENCY_CODE;
}

export function getCurrencySymbol(code?: string | null): string {
  const normalized = normalizeCurrencyCode(code);
  return CURRENCY_MAP[normalized as CurrencyCode]?.symbol ?? normalized;
}

export function getCurrencyLabel(code?: string | null): string {
  const normalized = normalizeCurrencyCode(code);
  return CURRENCY_MAP[normalized as CurrencyCode]?.label ?? normalized;
}

export function getFormatter(code?: string | null) {
  const normalized = normalizeCurrencyCode(code);
  if (!formatterCache.has(normalized)) {
    try {
      formatterCache.set(
        normalized,
        new Intl.NumberFormat(undefined, { style: "currency", currency: normalized })
      );
    } catch {
      formatterCache.set(
        normalized,
        new Intl.NumberFormat(undefined, { style: "currency", currency: DEFAULT_CURRENCY_CODE })
      );
    }
  }
  return formatterCache.get(normalized)!;
}

export function formatMoney(amount: number, code?: string | null): string {
  return getFormatter(code).format(amount ?? 0);
}

function isPdfSafe(text: string) {
  for (let i = 0; i < text.length; i += 1) {
    if (text.charCodeAt(i) > 255) return false;
  }
  return true;
}

export function formatMoneyForPdf(amount: number, code?: string | null): string {
  const normalized = normalizeCurrencyCode(code);
  const symbol = getCurrencySymbol(normalized);
  if (isPdfSafe(symbol)) {
    return formatMoney(amount, normalized);
  }
  const parts = getFormatter(normalized).formatToParts(amount ?? 0);
  const numericPortion = parts
    .filter((part) => part.type !== "currency")
    .map((part) => part.value)
    .join("")
    .trim();
  return `${normalized} ${numericPortion}`;
}

export const AVAILABLE_CURRENCIES = Object.entries(CURRENCY_MAP).map(([value, meta]) => ({
  value,
  label: `${value} — ${meta.label}`,
}));
