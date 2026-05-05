import { differenceInDays, parseISO } from "date-fns";

export function calculateFine(
  dueDate: string | Date,
  returnDate: Date = new Date(),
  finePerDay: number = 1,
): number {
  const due = typeof dueDate === "string" ? parseISO(dueDate) : dueDate;
  const overdueDays = differenceInDays(returnDate, due);
  if (overdueDays <= 0) return 0;

  // Staircase fine: 1x for days 1-7, 2x for days 8-30, 3x beyond
  if (overdueDays <= 7) return overdueDays * finePerDay;
  if (overdueDays <= 30) return 7 * finePerDay + (overdueDays - 7) * finePerDay * 2;
  return 7 * finePerDay + 23 * finePerDay * 2 + (overdueDays - 30) * finePerDay * 3;
}

export function formatCurrency(amount: number | string): string {
  return `₹${Number(amount).toFixed(2)}`;
}
