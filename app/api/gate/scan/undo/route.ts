import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { libraryVisits, auditLogs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { z } from "zod";

const undoSchema = z.object({ visitId: z.number().int() });

// Reverses whichever scan most recently changed this visit row — determined from
// the row's current state, not the client's memory of it, so it stays correct even
// if the row changed between the scan and the undo click:
//   - still open (exitTime is null)   -> the entry scan was a mistake -> delete the row
//   - already closed (exitTime is set) -> the exit scan was a mistake -> reopen it
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !["admin", "librarian", "staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = undoSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "visitId required" }, { status: 400 });

  const [visit] = await db.select().from(libraryVisits).where(eq(libraryVisits.id, parsed.data.visitId));
  if (!visit) return NextResponse.json({ error: "Scan not found" }, { status: 404 });

  const staffId = parseInt((session.user as any).id);

  if (visit.exitTime === null) {
    await db.delete(libraryVisits).where(eq(libraryVisits.id, visit.id));
    await db.insert(auditLogs).values({
      userId: staffId, action: "GATE_UNDO_ENTRY", entity: "library_visits", entityId: visit.id,
      oldValues: { memberId: visit.memberId, entryTime: visit.entryTime },
    });
    return NextResponse.json({ undone: "entry" });
  }

  const [reopened] = await db
    .update(libraryVisits)
    .set({ exitTime: null, durationMinutes: null, autoClosed: false })
    .where(eq(libraryVisits.id, visit.id))
    .returning();

  await db.insert(auditLogs).values({
    userId: staffId, action: "GATE_UNDO_EXIT", entity: "library_visits", entityId: visit.id,
    oldValues: { exitTime: visit.exitTime, durationMinutes: visit.durationMinutes },
  });

  return NextResponse.json({ undone: "exit", visit: reopened });
}
