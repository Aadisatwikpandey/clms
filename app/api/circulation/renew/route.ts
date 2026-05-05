import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { copies, circTransactions, members } from "@/lib/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { addDays, format } from "date-fns";
import { z } from "zod";

const renewSchema = z.object({ copyBarcode: z.string() });

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = renewSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });

  const [copy] = await db.select().from(copies).where(eq(copies.barcode, parsed.data.copyBarcode));
  if (!copy) return NextResponse.json({ error: "Copy not found" }, { status: 404 });

  const [txn] = await db
    .select()
    .from(circTransactions)
    .where(and(eq(circTransactions.copyId, copy.id), isNull(circTransactions.returnDate)))
    .limit(1);

  if (!txn) return NextResponse.json({ error: "No active loan found" }, { status: 404 });

  const [member] = await db.select().from(members).where(eq(members.id, txn.memberId));
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  if (txn.renewalCount >= member.maxRenewals) {
    return NextResponse.json({ error: `Max renewals (${member.maxRenewals}) reached` }, { status: 400 });
  }

  const newDueDate = format(addDays(new Date(), member.maxDays), "yyyy-MM-dd");
  const [updated] = await db
    .update(circTransactions)
    .set({ dueDate: newDueDate, renewalCount: txn.renewalCount + 1, transactionType: "renew", updatedAt: new Date() })
    .where(eq(circTransactions.id, txn.id))
    .returning();

  return NextResponse.json({ txn: updated, newDueDate });
}
