import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { libraryVisits, members, auditLogs } from "@/lib/db/schema";
import { eq, and, isNull, or } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { closeStaleVisits } from "@/lib/gate";
import { z } from "zod";

const scanSchema = z.object({ barcode: z.string().min(1) });

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !["admin", "librarian", "staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = scanSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Barcode required" }, { status: 400 });

  await closeStaleVisits();

  // Match on barcode or roll_no (USN) — the ID card barcode is the USN, but older
  // records created before that convention may only have it in roll_no.
  const [member] = await db
    .select()
    .from(members)
    .where(or(eq(members.barcode, parsed.data.barcode), eq(members.rollNo, parsed.data.barcode)));
  if (!member) return NextResponse.json({ error: "No member found for this barcode" }, { status: 404 });
  if (!member.isActive) return NextResponse.json({ error: `${member.name}'s membership is inactive` }, { status: 400 });

  const staffId = parseInt((session.user as any).id);

  const [open] = await db
    .select()
    .from(libraryVisits)
    .where(and(eq(libraryVisits.memberId, member.id), isNull(libraryVisits.exitTime)));

  if (open) {
    const exitTime = new Date();
    const durationMinutes = Math.round((exitTime.getTime() - open.entryTime.getTime()) / 60000);

    const [visit] = await db
      .update(libraryVisits)
      .set({ exitTime, durationMinutes })
      .where(eq(libraryVisits.id, open.id))
      .returning();

    await db.insert(auditLogs).values({
      userId: staffId,
      action: "GATE_EXIT",
      entity: "library_visits",
      entityId: visit.id,
      newValues: { memberId: member.id, durationMinutes },
    });

    return NextResponse.json({ action: "exit", member, visit });
  }

  const [visit] = await db
    .insert(libraryVisits)
    .values({ memberId: member.id, scannedBy: staffId })
    .returning();

  await db.insert(auditLogs).values({
    userId: staffId,
    action: "GATE_ENTRY",
    entity: "library_visits",
    entityId: visit.id,
    newValues: { memberId: member.id },
  });

  return NextResponse.json({ action: "entry", member, visit });
}
