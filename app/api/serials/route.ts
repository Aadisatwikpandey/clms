import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serials, serialIssues } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { addDays, addMonths, addWeeks, format } from "date-fns";

const serialSchema = z.object({
  title: z.string().min(1),
  issn: z.string().optional(),
  publisher: z.string().optional(),
  frequency: z.enum(["daily","weekly","fortnightly","monthly","quarterly","half_yearly","annually","irregular"]).default("monthly"),
  startVolume: z.number().int().optional(),
  startYear: z.number().int().optional(),
  subscriptionStart: z.string().optional(),
  subscriptionEnd: z.string().optional(),
  vendorId: z.number().int().optional(),
  annualCost: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  autoGenerateIssues: z.boolean().default(true),
  issueCount: z.number().int().default(12),
});

function nextIssueDate(base: Date, frequency: string): Date {
  switch (frequency) {
    case "daily": return addDays(base, 1);
    case "weekly": return addWeeks(base, 1);
    case "fortnightly": return addWeeks(base, 2);
    case "quarterly": return addMonths(base, 3);
    case "half_yearly": return addMonths(base, 6);
    case "annually": return addMonths(base, 12);
    default: return addMonths(base, 1);
  }
}

export async function GET(_req: NextRequest) {
  const rows = await db.select().from(serials).where(eq(serials.isActive, true)).orderBy(desc(serials.createdAt));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !["admin","librarian","staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = serialSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });

  const { autoGenerateIssues, issueCount, ...serialData } = parsed.data;
  const [serial] = await db.insert(serials).values(serialData).returning();

  if (autoGenerateIssues && parsed.data.subscriptionStart) {
    const issues = [];
    let currentDate = new Date(parsed.data.subscriptionStart);
    for (let i = 1; i <= issueCount; i++) {
      issues.push({
        serialId: serial.id,
        volume: parsed.data.startVolume ?? 1,
        issueNo: String(i),
        expectedDate: format(currentDate, "yyyy-MM-dd"),
        status: "expected" as const,
      });
      currentDate = nextIssueDate(currentDate, parsed.data.frequency);
    }
    await db.insert(serialIssues).values(issues);
  }

  return NextResponse.json(serial, { status: 201 });
}
