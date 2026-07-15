import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serialIssues, members } from "@/lib/db/schema";
import { eq, desc, or } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { z } from "zod";

const issueUpdateSchema = z.object({
  issueId: z.number().int(),
  status: z.enum(["expected","received","missing","claimed","bound"]),
  receivedDate: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const issues = await db
    .select({
      id: serialIssues.id, serialId: serialIssues.serialId, volume: serialIssues.volume,
      issueNo: serialIssues.issueNo, issueDate: serialIssues.issueDate, expectedDate: serialIssues.expectedDate,
      receivedDate: serialIssues.receivedDate, status: serialIssues.status, barcode: serialIssues.barcode,
      location: serialIssues.location, notes: serialIssues.notes,
      issuedToMemberId: serialIssues.issuedToMemberId, issuedAt: serialIssues.issuedAt,
      dueDate: serialIssues.dueDate, returnedAt: serialIssues.returnedAt,
      issuedToName: members.name, issuedToRollNo: members.rollNo,
    })
    .from(serialIssues)
    .leftJoin(members, eq(serialIssues.issuedToMemberId, members.id))
    .where(eq(serialIssues.serialId, parseInt(id)))
    .orderBy(desc(serialIssues.expectedDate));
  return NextResponse.json(issues);
}

const circulateSchema = z.object({
  issueId: z.number().int(),
  action: z.enum(["issue", "return"]),
  memberBarcode: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !["admin", "librarian", "staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = circulateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });

  const [issue] = await db.select().from(serialIssues).where(eq(serialIssues.id, parsed.data.issueId));
  if (!issue) return NextResponse.json({ error: "Issue not found" }, { status: 404 });

  if (parsed.data.action === "issue") {
    if (issue.issuedToMemberId && !issue.returnedAt) {
      return NextResponse.json({ error: "This issue is already checked out" }, { status: 400 });
    }
    if (!parsed.data.memberBarcode) return NextResponse.json({ error: "memberBarcode required" }, { status: 400 });

    const [member] = await db.select().from(members)
      .where(or(eq(members.barcode, parsed.data.memberBarcode), eq(members.rollNo, parsed.data.memberBarcode)));
    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 3);
    const [updated] = await db.update(serialIssues).set({
      issuedToMemberId: member.id,
      issuedAt: new Date(),
      dueDate: dueDate.toISOString().split("T")[0],
      returnedAt: null,
    }).where(eq(serialIssues.id, issue.id)).returning();

    return NextResponse.json({ issue: updated, member });
  }

  // return
  if (!issue.issuedToMemberId || issue.returnedAt) {
    return NextResponse.json({ error: "This issue isn't currently checked out" }, { status: 400 });
  }
  const [updated] = await db.update(serialIssues).set({ returnedAt: new Date() }).where(eq(serialIssues.id, issue.id)).returning();
  return NextResponse.json({ issue: updated });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session || !["admin","librarian","staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = issueUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });

  const { issueId, ...updates } = parsed.data;
  const [updated] = await db
    .update(serialIssues)
    .set(updates)
    .where(eq(serialIssues.id, issueId))
    .returning();

  return NextResponse.json(updated);
}
