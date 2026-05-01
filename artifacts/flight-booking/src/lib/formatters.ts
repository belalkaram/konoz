const TO_USD: Record<string, number> = {
  USD: 1,
  GBP: 1.263,
  EUR: 1.084,
  AED: 0.272,
  QAR: 0.274,
  EGP: 0.02062,
  KWD: 3.252,
  SAR: 0.2666,
  BHD: 2.653,
  OMR: 2.597,
  JOD: 1.411,
  TRY: 0.029,
  CHF: 1.104,
  CAD: 0.731,
  AUD: 0.643,
  CNY: 0.138,
  JPY: 0.0066,
  INR: 0.012,
};

export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): number {
  if (fromCurrency === toCurrency) return amount;
  const fromRate = TO_USD[fromCurrency.toUpperCase()] ?? 1;
  const toRate = TO_USD[toCurrency.toUpperCase()] ?? 1;
  return (amount * fromRate) / toRate;
}

export function formatCurrency(
  amount: string | number | null | undefined,
  sourceCurrency?: string | null,
  displayCurrency?: string | null
) {
  if (amount == null) return "—";
  const numericAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(numericAmount)) return "—";

  const src = sourceCurrency ?? "USD";
  const dst = displayCurrency ?? src;

  const converted =
    dst !== src ? convertCurrency(numericAmount, src, dst) : numericAmount;

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: dst,
      maximumFractionDigits: dst === "KWD" ? 3 : 0,
    }).format(converted);
  } catch {
    return converted.toFixed(2);
  }
}

export function formatDateTime(isoString: string | null | undefined) {
  if (!isoString) return "—";
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatDate(isoString: string | null | undefined) {
  if (!isoString) return "—";
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatShortDate(isoString: string | null | undefined) {
  if (!isoString) return "—";
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatTime(isoString: string | null | undefined) {
  if (!isoString) return "—";
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDuration(duration: string) {
  const match = duration.match(/PT(\d+H)?(\d+M)?/);
  if (!match) return duration;

  const hours = match[1] ? match[1].replace("H", "") : "0";
  const minutes = match[2] ? match[2].replace("M", "") : "0";

  if (hours === "0") return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

export function calculateDaysRemaining(isoString: string | null | undefined): { days: number | null; label: string; color: string } {
  if (!isoString) return { days: null, label: "—", color: "text-muted-foreground" };
  const targetDate = new Date(isoString);
  if (isNaN(targetDate.getTime())) return { days: null, label: "—", color: "text-muted-foreground" };

  const now = new Date();
  // Set both to midnight for simple day difference
  const d1 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d2 = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  
  const diffTime = d2.getTime() - d1.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { days: diffDays, label: "Departed", color: "text-muted-foreground" };
  if (diffDays === 0) return { days: 0, label: "Travels Today", color: "text-destructive font-bold animate-pulse" };
  if (diffDays === 1) return { days: 1, label: "1 Day Left", color: "text-destructive font-semibold" };
  if (diffDays <= 3) return { days: diffDays, label: `${diffDays} Days Left`, color: "text-orange-600 font-semibold" };
  
  return { days: diffDays, label: `${diffDays} Days Left`, color: "text-emerald-600 font-medium" };
}
