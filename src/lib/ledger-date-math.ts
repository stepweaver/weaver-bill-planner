/** Calendar-day arithmetic in UTC: insensitive to server timezone and DST. */
export function ledgerDayNumber(iso: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [year, month, day] = iso.split("-").map(Number);
  const millis = Date.UTC(year, month - 1, day);
  const check = new Date(millis);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day) return null;
  return Math.floor(millis / 86_400_000);
}

export function daysUntilLedgerDate(date: string, todayIso: string): number | null {
  const target = ledgerDayNumber(date);
  const today = ledgerDayNumber(todayIso);
  return target == null || today == null ? null : target - today;
}

export function addLedgerDays(todayIso: string, days: number): string {
  const number = ledgerDayNumber(todayIso);
  if (number == null || !Number.isInteger(days)) throw new Error("Invalid ledger date or day offset");
  return new Date((number + days) * 86_400_000).toISOString().slice(0, 10);
}
