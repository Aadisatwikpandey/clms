import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { catalogueItems, copies } from "@/lib/db/schema";
import { eq, ilike, or, desc, and, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { indexCatalogueItem } from "@/lib/search/elasticsearch";
import { generateAccessionNo, generateCopyBarcode } from "@/lib/utils/barcode";
import { invalidateCache } from "@/lib/redis";

const bookSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional(),
  materialType: z.enum(["book","journal","magazine","newspaper","av_material","map","manuscript","thesis","digital","other"]).default("book"),
  authors: z.array(z.string()).default([]),
  editors: z.array(z.string()).default([]),
  publisher: z.string().optional(),
  publicationYear: z.number().int().optional(),
  publicationPlace: z.string().optional(),
  edition: z.string().optional(),
  isbn: z.string().optional(),
  issn: z.string().optional(),
  deweyNo: z.string().optional(),
  callNumber: z.string().optional(),
  subjects: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  language: z.string().default("English"),
  pages: z.number().int().optional(),
  price: z.string().optional(),
  currency: z.string().default("INR"),
  location: z.string().optional(),
  shelfNo: z.string().optional(),
  rackNo: z.string().optional(),
  abstract: z.string().optional(),
  notes: z.string().optional(),
  copies: z.number().int().min(1).default(1),
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);
  const q = searchParams.get("q") ?? "";
  const materialType = searchParams.get("type") ?? "";
  const offset = (page - 1) * limit;

  const conditions = [];
  if (q) conditions.push(or(ilike(catalogueItems.title, `%${q}%`), ilike(catalogueItems.isbn, `%${q}%`)));
  if (materialType) conditions.push(eq(catalogueItems.materialType, materialType as any));
  conditions.push(eq(catalogueItems.isActive, true));

  const where = conditions.length ? and(...conditions) : undefined;

  const [items, [{ count }]] = await Promise.all([
    db.select().from(catalogueItems).where(where).orderBy(desc(catalogueItems.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(catalogueItems).where(where),
  ]);

  return NextResponse.json({ items, total: Number(count), page, limit });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !["admin","librarian","staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = bookSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });

  const data = parsed.data;

  // Generate accession number
  const [{ maxSeq }] = await db.select({ maxSeq: sql<number>`coalesce(max(id), 0)` }).from(catalogueItems);
  const year = new Date().getFullYear();
  const accessionNo = generateAccessionNo(year, Number(maxSeq) + 1);

  const [item] = await db.insert(catalogueItems).values({
    ...data,
    accessionNo,
    totalCopies: data.copies,
    availableCopies: data.copies,
    authors: data.authors,
    editors: data.editors,
    subjects: data.subjects,
    keywords: data.keywords,
  }).returning();

  // Create physical copies
  const copyRows = Array.from({ length: data.copies }, (_, i) => ({
    catalogueItemId: item.id,
    barcode: generateCopyBarcode(accessionNo, i + 1),
    copyNo: i + 1,
  }));
  await db.insert(copies).values(copyRows);

  // Index in Elasticsearch
  await indexCatalogueItem(item).catch(() => {});
  await invalidateCache("catalogue:*");

  return NextResponse.json(item, { status: 201 });
}
