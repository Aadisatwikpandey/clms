import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { members } from "@/lib/db/schema";
import { eq, ilike, or, desc, and, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { generateMemberBarcode } from "@/lib/utils/barcode";

const memberSchema = z.object({
  name: z.string().min(1),
  memberType: z.enum(["student","faculty","staff","external"]).default("student"),
  department: z.string().optional(),
  course: z.string().optional(),
  rollNo: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  membershipStartDate: z.string().optional(),
  membershipEndDate: z.string().optional(),
  maxBooks: z.number().int().default(3),
  maxDays: z.number().int().default(14),
  maxRenewals: z.number().int().default(2),
  finePerDay: z.string().default("1.00"),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || !["admin","librarian","staff","finance"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);
  const q = searchParams.get("q") ?? "";
  const memberType = searchParams.get("type") ?? "";
  const department = searchParams.get("dept") ?? "";
  const offset = (page - 1) * limit;

  const conditions = [eq(members.isActive, true)];
  if (q) conditions.push(or(ilike(members.name, `%${q}%`), ilike(members.membershipNo, `%${q}%`), ilike(members.email, `%${q}%`)) as any);
  if (memberType) conditions.push(eq(members.memberType, memberType as any));
  if (department) conditions.push(ilike(members.department, `%${department}%`));

  const where = and(...conditions);
  const [rows, [{ count }]] = await Promise.all([
    db.select().from(members).where(where).orderBy(desc(members.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(members).where(where),
  ]);

  return NextResponse.json({ members: rows, total: Number(count), page, limit });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !["admin","librarian","staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = memberSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });

  if (parsed.data.rollNo) {
    const [existing] = await db.select({ id: members.id, name: members.name }).from(members).where(eq(members.rollNo, parsed.data.rollNo));
    if (existing) {
      return NextResponse.json({ error: `USN ${parsed.data.rollNo} is already registered to ${existing.name}` }, { status: 409 });
    }
  }

  const [{ maxSeq }] = await db.select({ maxSeq: sql<number>`coalesce(max(id), 0)` }).from(members);
  const seq = Number(maxSeq) + 1;
  const year = new Date().getFullYear();
  const membershipNo = `AMC/${year}/${String(seq).padStart(5, "0")}`;
  // The physical ID card barcode is the student's USN (roll_no) when available —
  // non-student members (faculty/staff/external) without a roll_no fall back to a generated code.
  const barcode = parsed.data.rollNo || generateMemberBarcode(membershipNo);

  const [member] = await db.insert(members).values({
    ...parsed.data,
    membershipNo,
    barcode,
  }).returning();

  return NextResponse.json(member, { status: 201 });
}
