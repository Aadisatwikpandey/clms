import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { libraryVisits, members } from "@/lib/db/schema";
import { eq, gte, lte, and, desc, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { closeStaleVisits } from "@/lib/gate";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || !["admin", "librarian", "staff", "finance", "readonly"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await closeStaleVisits();

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const department = searchParams.get("department");
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
  const offset = (page - 1) * limit;

  const conditions: any[] = [];
  if (from) conditions.push(gte(libraryVisits.entryTime, new Date(from)));
  if (to) conditions.push(lte(libraryVisits.entryTime, new Date(to)));
  if (department) conditions.push(eq(members.department, department));
  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: libraryVisits.id,
        entryTime: libraryVisits.entryTime,
        exitTime: libraryVisits.exitTime,
        durationMinutes: libraryVisits.durationMinutes,
        autoClosed: libraryVisits.autoClosed,
        name: members.name,
        rollNo: members.rollNo,
        department: members.department,
        memberType: members.memberType,
      })
      .from(libraryVisits)
      .innerJoin(members, eq(libraryVisits.memberId, members.id))
      .where(where)
      .orderBy(desc(libraryVisits.entryTime))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)` })
      .from(libraryVisits)
      .innerJoin(members, eq(libraryVisits.memberId, members.id))
      .where(where),
  ]);

  return NextResponse.json({ visits: rows, total: Number(total), page });
}
