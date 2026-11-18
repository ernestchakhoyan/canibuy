/**
 * Parses user-typed amounts: "20,000", "$20 000", "1500.50", "12,5".
 * A comma followed by 1-2 trailing digits is a decimal separator, otherwise a thousands separator.
 */
export const parseAmount = (input: string): number | null => {
  let s = input.replace(/[^\d.,-]/g, "");
  s = !s.includes(".") && /,\d{1,2}$/.test(s) ? s.replace(",", ".") : s.replaceAll(",", "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

export const formatMoney = (amount: number, currency: string) =>
  `${amount < 0 ? "−" : ""}${currency}${Math.abs(amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export const newId = () => crypto.randomUUID().replaceAll("-", "").slice(0, 8);
