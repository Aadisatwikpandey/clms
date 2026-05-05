import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stockSessions, stockVerifications, copies } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { z } from "zod";

const sessionSchema = z.object({ sessionName: z.string().min(1) });
const scanSchema = z.object({
  sessionId: z.number().int(),
  barcodes: z.array(z.string()).min(1),
});
const withdrawSchema = z.object({
  copyIds: z.array(z.number().int()).min(1),
  reason: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || !["admin","librarian","staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessions = await db.select().from(stockSessions).orderBy(desc(stockSessions.startedAt)).limit(20);
  return NextResponse.json(sessions);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !["admin","librarian"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { action } = body;

  if (action === "create") {
    const parsed = sessionSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });

    const [{ totalCopies }] = await db.select({ totalCopies: sql<number>`count(*)` }).from(copies).where(eq(copies.isActive, true));
    const [sess] = await db.insert(stockSessions).values({
      sessionName: parsed.data.sessionName,
      totalExpected: Number(totalCopies),
      conductedBy: parseInt((session.user as any).id),
    }).returning();
    return NextResponse.json(sess, { status: 201 });
  }

  if (action === "scan") {
    const parsed = scanSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });

    const results = [];
    for (const barcode of parsed.data.barcodes) {
      const [copy] = await db.select().from(copies).where(eq(copies.barcode, barcode));
      if (!copy) { results.push({ barcode, found: false }); continue; }

      await db.insert(stockVerifications).values({
        sessionId: parsed.data.sessionId,
        copyId: copy.id,
        scannedBarcode: barcode,
      }).onConflictDoNothing();

      await db.update(stockSessions).set({
        totalVerified: sql`total_verified + 1`,
      }).where(eq(stockSessions.id, parsed.data.sessionId));

      results.push({ barcode, found: true, copyId: copy.id });
    }
    return NextResponse.json(results);
  }

  if (action === "complete") {
    const { sessionId } = body;
    await db.update(stockSessions).set({
      completedAt: new Date(),
      status: "completed",
    }).where(eq(stockSessions.id, sessionId));
    return NextResponse.json({ success: true });
  }

  if (action === "withdraw") {
    const parsed = withdrawSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });

    await db.update(copies)
      .set({ status: "withdrawn", isActive: false, notes: parsed.data.reason ?? "Mass withdrawal" })
      .where(sql`id = ANY(${parsed.data.copyIds})`);

    return NextResponse.json({ withdrawn: parsed.data.copyIds.length });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
