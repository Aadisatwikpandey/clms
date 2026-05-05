import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { budgetHeads } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { z } from "zod";

const budgetSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  type: z.enum(["income","expense"]).default("expense"),
  financialYear: z.string(),
  department: z.string().optional(),
  allocatedAmount: z.string().default("0"),
  parentId: z.number().int().optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || !["admin","finance","librarian"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const fy = searchParams.get("fy");

  let query = db.select().from(budgetHeads).where(eq(budgetHeads.isActive, true)).$dynamic();
  if (fy) query = query.where(eq(budgetHeads.financialYear, fy) as any);

  const rows = await query.orderBy(desc(budgetHeads.createdAt));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !["admin","finance"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = budgetSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });

  const [budget] = await db.insert(budgetHeads).values(parsed.data).returning();
  return NextResponse.json(budget, { status: 201 });
}
