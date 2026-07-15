import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { libraryVisits, members } from "@/lib/db/schema";
import { isNull, eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { closeStaleVisits } from "@/lib/gate";

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session || !["admin", "librarian", "staff", "finance", "readonly"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await closeStaleVisits();

  const visitors = await db
    .select({
      visitId: libraryVisits.id,
      entryTime: libraryVisits.entryTime,
      memberId: members.id,
      name: members.name,
      department: members.department,
      memberType: members.memberType,
      rollNo: members.rollNo,
      barcode: members.barcode,
    })
    .from(libraryVisits)
    .innerJoin(members, eq(libraryVisits.memberId, members.id))
    .where(isNull(libraryVisits.exitTime))
    .orderBy(desc(libraryVisits.entryTime));

  return NextResponse.json({ count: visitors.length, visitors });
}
