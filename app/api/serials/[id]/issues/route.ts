import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serialIssues } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
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
    .select()
    .from(serialIssues)
    .where(eq(serialIssues.serialId, parseInt(id)))
    .orderBy(desc(serialIssues.expectedDate));
  return NextResponse.json(issues);
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
