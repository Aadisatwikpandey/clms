import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { copies, circTransactions, catalogueItems, fineRecords, members, auditLogs, reservations } from "@/lib/db/schema";
import { eq, and, sql, isNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { calculateFine } from "@/lib/utils/fine";
import { z } from "zod";
import { generateReceiptNo } from "@/lib/utils/barcode";

const returnSchema = z.object({
  copyBarcodes: z.array(z.string()).min(1),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !["admin","librarian","staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = returnSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });

  const { copyBarcodes } = parsed.data;
  const staffId = parseInt((session.user as any).id);
  const returned = [];
  const errors = [];

  for (const barcode of copyBarcodes) {
    const [copy] = await db.select().from(copies).where(eq(copies.barcode, barcode));
    if (!copy) { errors.push(`Copy ${barcode} not found`); continue; }

    const [txn] = await db
      .select()
      .from(circTransactions)
      .where(and(eq(circTransactions.copyId, copy.id), isNull(circTransactions.returnDate), sql`transaction_type IN ('issue','overnight','renew')`))
      .limit(1);

    if (!txn) { errors.push(`No active loan for ${barcode}`); continue; }

    const now = new Date();
    const fineAmount = txn.dueDate
      ? calculateFine(txn.dueDate, now, Number(txn.fineAmount ?? 1))
      : 0;

    // Update transaction
    await db.update(circTransactions).set({
      returnDate: now,
      fineAmount: String(fineAmount),
      fineStatus: fineAmount > 0 ? "pending" : "paid",
      updatedAt: now,
    }).where(eq(circTransactions.id, txn.id));

    // Mark copy available
    await db.update(copies).set({ status: "available" }).where(eq(copies.id, copy.id));
    await db.update(catalogueItems).set({ availableCopies: sql`available_copies + 1` }).where(eq(catalogueItems.id, copy.catalogueItemId));

    // Create fine record if needed
    let fineRecord = null;
    if (fineAmount > 0) {
      const [member] = await db.select().from(members).where(eq(members.id, txn.memberId));
      [fineRecord] = await db.insert(fineRecords).values({
        memberId: txn.memberId,
        transactionId: txn.id,
        amount: String(fineAmount),
        reason: `Overdue fine for copy ${barcode}`,
        receiptNo: generateReceiptNo(),
      }).returning();

      await db.update(members).set({
        totalFinesDue: sql`total_fines_due + ${fineAmount}`,
      }).where(eq(members.id, txn.memberId));
    }

    // Check for pending reservations and notify
    const [pendingReservation] = await db
      .select()
      .from(reservations)
      .where(and(eq(reservations.catalogueItemId, copy.catalogueItemId), eq(reservations.status, "active")))
      .limit(1);

    if (pendingReservation) {
      await db.update(reservations).set({ copyId: copy.id, status: "ready", notifiedAt: now }).where(eq(reservations.id, pendingReservation.id));
      await db.update(copies).set({ status: "reserved" }).where(eq(copies.id, copy.id));
    }

    await db.insert(auditLogs).values({
      userId: staffId,
      action: "RETURN",
      entity: "circ_transactions",
      entityId: txn.id,
      newValues: { returnDate: now, fineAmount },
    });

    returned.push({ txn: { ...txn, returnDate: now }, copy, fineAmount, fineRecord });
  }

  return NextResponse.json({ returned, errors });
}
