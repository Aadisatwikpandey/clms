import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { digitalResources } from "@/lib/db/schema";
import { eq, ilike, desc, and, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { z } from "zod";

const resourceSchema = z.object({
  title: z.string().min(1),
  resourceType: z.string().default("article"),
  authors: z.array(z.string()).default([]),
  source: z.string().optional(),
  fileUrl: z.string().optional(),
  externalUrl: z.string().optional(),
  subjects: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  language: z.string().default("English"),
  publicationYear: z.number().int().optional(),
  abstract: z.string().optional(),
  isPublic: z.boolean().default(true),
  catalogueItemId: z.number().int().optional(),
  dublinCoreMetadata: z.record(z.string(), z.string()).optional(),
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const type = searchParams.get("type") ?? "";
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = 20;
  const offset = (page - 1) * limit;

  const conditions: any[] = [eq(digitalResources.isActive, true)];
  if (!(await isStaff())) conditions.push(eq(digitalResources.isPublic, true));
  if (q) conditions.push(ilike(digitalResources.title, `%${q}%`));
  if (type) conditions.push(eq(digitalResources.resourceType, type));

  const [rows, [{ totalCount }]] = await Promise.all([
    db.select().from(digitalResources).where(and(...conditions)).orderBy(desc(digitalResources.createdAt)).limit(limit).offset(offset),
    db.select({ totalCount: sql<number>`count(*)` }).from(digitalResources).where(and(...conditions)),
  ]);

  return NextResponse.json({ resources: rows, total: Number(totalCount), page });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !["admin","librarian","staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = resourceSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });

  const [resource] = await db.insert(digitalResources).values(parsed.data).returning();
  return NextResponse.json(resource, { status: 201 });
}

async function isStaff(): Promise<boolean> {
  try {
    const session = await auth();
    return !!session && ["admin","librarian","staff","finance"].includes((session.user as any).role);
  } catch { return false; }
}

