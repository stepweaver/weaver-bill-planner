/**
 * Exact-cent helpers for the available-bank-balance snapshot.
 * Stored as PostgreSQL numeric(12,2). Bill and income amounts elsewhere are `real`
 * and stay that way; these helpers only round at the snapshot boundary.
 */

const MAX_ABS_CENTS = 999_999_999_999;

/** Nearest cent. Used so float bill amounts and the decimal balance share one scale. */
export function toCents(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100);
}

export function centsToDollars(cents: number): number {
  return cents / 100;
}

/**
 * Parse a typed dollar amount into a canonical numeric(12,2) string.
 * Accepts optional $ and commas. At most two decimal places. Empty is null, not zero.
 */
export function parseAvailableBalanceInput(raw: string): string | null {
  const trimmed = raw.trim().replace(/[$,]/g, "").replace(/\s/g, "");
  if (!/^-?\d+(\.\d{0,2})?$/.test(trimmed)) return null;
  const negative = trimmed.startsWith("-");
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const [whole, frac = ""] = unsigned.split(".");
  if (whole.length > 10) return null;
  const cents = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  if (!Number.isSafeInteger(cents) || cents > MAX_ABS_CENTS) return null;
  if (cents === 0) return "0.00";
  const abs = String(cents).padStart(3, "0");
  const sign = negative ? "-" : "";
  return `${sign}${abs.slice(0, -2)}.${abs.slice(-2)}`;
}

/** Read a numeric(12,2) column (string or driver number) back to a dollar amount. */
export function numericToNumber(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return centsToDollars(toCents(value));
  }
  const parsed = parseAvailableBalanceInput(value);
  if (parsed == null) return null;
  const negative = parsed.startsWith("-");
  const [whole, frac] = parsed.replace("-", "").split(".");
  const cents = Number(whole) * 100 + Number(frac);
  return centsToDollars(negative ? -cents : cents);
}
