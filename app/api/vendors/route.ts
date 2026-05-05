import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { vendors } from "@/lib/db/schema";
import { eq, ilike, desc, and, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { z } from "zod";

const vendorSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  contactPerson: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().default("India"),
  gstNo: z.string().optional(),
  panNo: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || !["admin","librarian","staff","finance"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = 20;
  const offset = (page - 1) * limit;

  const conditions = [eq(vendors.isActive, true)];
  if (q) conditions.push(ilike(vendors.name, `%${q}%`) as any);

  const rows = await db.select().from(vendors).where(and(...conditions)).orderBy(desc(vendors.createdAt)).limit(limit).offset(offset);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !["admin","librarian"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = vendorSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });

  const [vendor] = await db.insert(vendors).values(parsed.data).returning();
  return NextResponse.json(vendor, { status: 201 });
}
