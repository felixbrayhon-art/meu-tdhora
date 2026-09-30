/** Return a YYYY-MM-DD key using the user's local calendar date. */
export const toLocalDateKey = (value: Date | string | number = new Date()): string => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/** Add calendar days without converting through UTC (which can shift the date). */
export const addLocalDays = (value: Date | string | number, days: number): string => {
  const dateKey = toLocalDateKey(value);
  if (!dateKey) return '';

  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  date.setDate(date.getDate() + days);
  return toLocalDateKey(date);
};

/** Difference in calendar days, independent of time of day and daylight saving. */
export const daysBetweenLocalDateKeys = (from: string, to: string): number | null => {
  const dateKeyPattern = /^(\d{4})-(\d{2})-(\d{2})$/;
  const fromParts = dateKeyPattern.exec(from);
  const toParts = dateKeyPattern.exec(to);
  if (!fromParts || !toParts) return null;

  const fromUtc = Date.UTC(Number(fromParts[1]), Number(fromParts[2]) - 1, Number(fromParts[3]));
  const toUtc = Date.UTC(Number(toParts[1]), Number(toParts[2]) - 1, Number(toParts[3]));
  return Math.round((toUtc - fromUtc) / 86_400_000);
};
