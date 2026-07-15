import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fineRecords, members } from "@/lib/db/schema";
import { eq, desc, sql, and, or, ilike } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { generateReceiptNo } from "@/lib/utils/barcode";
import { sendEmail, fineReceiptHtml } from "@/lib/email";
import { format } from "date-fns";

const collectSchema = z.object({
  fineId: z.number().int(),
  sendReceipt: z.boolean().default(true),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || !["admin","librarian","staff","finance"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const memberId = searchParams.get("memberId");
  const status = searchParams.get("status");
  const q = searchParams.get("q");
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);
  const offset = (page - 1) * limit;

  const conditions = [];
  if (memberId) conditions.push(eq(fineRecords.memberId, parseInt(memberId)));
  if (status && status !== "all") conditions.push(eq(fineRecords.status, status as any));
  if (q) conditions.push(or(ilike(members.rollNo, `%${q}%`), ilike(members.name, `%${q}%`), ilike(members.membershipNo, `%${q}%`)));
  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: fineRecords.id,
        memberId: fineRecords.memberId,
        amount: fineRecords.amount,
        reason: fineRecords.reason,
        status: fineRecords.status,
        receiptNo: fineRecords.receiptNo,
        createdAt: fineRecords.createdAt,
        memberName: members.name,
        rollNo: members.rollNo,
        membershipNo: members.membershipNo,
      })
      .from(fineRecords)
      .innerJoin(members, eq(fineRecords.memberId, members.id))
      .where(where)
      .orderBy(desc(fineRecords.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: sql<number>`count(*)` }).from(fineRecords).innerJoin(members, eq(fineRecords.memberId, members.id)).where(where),
  ]);

  return NextResponse.json({ fines: rows, total: Number(total), page });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !["admin","librarian","staff","finance"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = collectSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });

  const { fineId, sendReceipt } = parsed.data;
  const staffId = parseInt((session.user as any).id);

  const [fine] = await db.select().from(fineRecords).where(eq(fineRecords.id, fineId));
  if (!fine) return NextResponse.json({ error: "Fine not found" }, { status: 404 });
  if (fine.status === "paid") return NextResponse.json({ error: "Already paid" }, { status: 400 });

  const receiptNo = generateReceiptNo();
  const [updated] = await db
    .update(fineRecords)
    .set({ status: "paid", collectedBy: staffId, collectedAt: new Date(), receiptNo })
    .where(eq(fineRecords.id, fineId))
    .returning();

  await db.update(members).set({
    totalFinesDue: sql`greatest(total_fines_due - ${fine.amount}, 0)`,
    totalFinesPaid: sql`total_fines_paid + ${fine.amount}`,
  }).where(eq(members.id, fine.memberId));

  if (sendReceipt) {
    const [member] = await db.select().from(members).where(eq(members.id, fine.memberId));
    if (member?.email) {
      await sendEmail(
        member.email,
        "Fine Payment Receipt – AMC Library",
        fineReceiptHtml({
          memberName: member.name,
          receiptNo,
          amount: String(fine.amount),
          date: format(new Date(), "dd/MM/yyyy"),
        })
      ).catch(() => {});
    }
  }

  return NextResponse.json(updated);
}
