import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { copies, members, circTransactions, catalogueItems, auditLogs } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { addDays, format } from "date-fns";
import { z } from "zod";

const issueSchema = z.object({
  memberBarcode: z.string(),
  copyBarcodes: z.array(z.string()).min(1).max(10),
  isOvernight: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !["admin","librarian","staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = issueSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });

  const { memberBarcode, copyBarcodes, isOvernight } = parsed.data;

  // Fetch member
  const [member] = await db.select().from(members).where(eq(members.barcode, memberBarcode));
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });
  if (!member.isActive) return NextResponse.json({ error: "Member account is inactive" }, { status: 400 });
  if (member.isSuspended) return NextResponse.json({ error: `Member suspended until ${member.suspendedUntil}` }, { status: 400 });

  // Check current issued count
  const [{ currentCount }] = await db
    .select({ currentCount: sql<number>`count(*)` })
    .from(circTransactions)
    .where(and(eq(circTransactions.memberId, member.id), eq(circTransactions.transactionType, "issue"), sql`return_date IS NULL`));

  if (Number(currentCount) + copyBarcodes.length > member.maxBooks) {
    return NextResponse.json({
      error: `Cannot issue ${copyBarcodes.length} book(s). Member already has ${currentCount}/${member.maxBooks} books.`
    }, { status: 400 });
  }

  const staffId = parseInt((session.user as any).id);
  const dueDate = isOvernight
    ? format(addDays(new Date(), 1), "yyyy-MM-dd")
    : format(addDays(new Date(), member.maxDays), "yyyy-MM-dd");

  const issued = [];
  const errors = [];

  for (const barcode of copyBarcodes) {
    const [copy] = await db.select().from(copies).where(eq(copies.barcode, barcode));
    if (!copy) { errors.push(`Copy ${barcode} not found`); continue; }
    if (copy.status !== "available") { errors.push(`Copy ${barcode} is ${copy.status}`); continue; }

    // Issue the copy
    await db.update(copies).set({ status: "issued" }).where(eq(copies.id, copy.id));
    await db.update(catalogueItems).set({ availableCopies: sql`available_copies - 1` }).where(eq(catalogueItems.id, copy.catalogueItemId));

    const [txn] = await db.insert(circTransactions).values({
      memberId: member.id,
      copyId: copy.id,
      transactionType: isOvernight ? "overnight" : "issue",
      issueDate: new Date(),
      dueDate,
      staffId,
    }).returning();

    // Audit log
    await db.insert(auditLogs).values({
      userId: staffId,
      action: "ISSUE",
      entity: "circ_transactions",
      entityId: txn.id,
      newValues: { memberId: member.id, copyId: copy.id, dueDate },
    });

    issued.push({ txn, copy, dueDate });
  }

  return NextResponse.json({ issued, errors, member });
}
