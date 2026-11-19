const pad = (n: number) => String(n).padStart(2, "0");

/** Local date as YYYY-MM-DD. */
export const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const todayISO = () => toISODate(new Date());

export const parseISODate = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const monthOf = (date: string) => date.slice(0, 7);

export const daysInMonth = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
};

export const addMonths = (month: string, n: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

export const addDays = (date: string, n: number) => {
  const d = parseISODate(date);
  d.setDate(d.getDate() + n);
  return toISODate(d);
};

export const monthLabel = (month: string, locale: string) =>
  new Date(`${month}-01T00:00`).toLocaleDateString(locale, { month: "long", year: "numeric" });

export type Period = "day" | "week" | "month" | "year";

/** Inclusive [from, to] range of ISO dates for the period containing `date`. Weeks run Monday to Sunday. */
export const periodRange = (period: Period, date: string): [string, string] => {
  if (period === "day") return [date, date];
  if (period === "week") {
    const offset = (parseISODate(date).getDay() + 6) % 7;
    const from = addDays(date, -offset);
    return [from, addDays(from, 6)];
  }
  if (period === "month") {
    const month = monthOf(date);
    return [`${month}-01`, `${month}-${pad(daysInMonth(month))}`];
  }
  const year = date.slice(0, 4);
  return [`${year}-01-01`, `${year}-12-31`];
};

/** Moves `date` by one period in `direction` (-1 or 1). */
export const shiftPeriod = (period: Period, date: string, direction: number) => {
  if (period === "day") return addDays(date, direction);
  if (period === "week") return addDays(date, 7 * direction);
  if (period === "month") return `${addMonths(monthOf(date), direction)}-01`;
  return `${Number(date.slice(0, 4)) + direction}-01-01`;
};
