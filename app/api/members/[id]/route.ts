import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { members, circTransactions, fineRecords, reservations } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const memberId = parseInt(id);

  // Members can only see their own profile
  const userRole = (session.user as any).role;
  const userMemberId = (session.user as any).memberId;
  if (userRole === "member" && userMemberId !== memberId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [member] = await db.select().from(members).where(eq(members.id, memberId));
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [transactions, fines, memberReservations] = await Promise.all([
    db.select().from(circTransactions).where(eq(circTransactions.memberId, memberId)).orderBy(desc(circTransactions.createdAt)).limit(50),
    db.select().from(fineRecords).where(eq(fineRecords.memberId, memberId)).orderBy(desc(fineRecords.createdAt)),
    db.select().from(reservations).where(eq(reservations.memberId, memberId)),
  ]);

  return NextResponse.json({ ...member, transactions, fines, reservations: memberReservations });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !["admin","librarian","staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const [updated] = await db
    .update(members)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(members.id, parseInt(id)))
    .returning();

  return NextResponse.json(updated);
}
