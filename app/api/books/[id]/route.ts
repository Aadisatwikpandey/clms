import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { catalogueItems, copies } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { indexCatalogueItem, deleteCatalogueItem } from "@/lib/search/elasticsearch";
import { invalidateCache } from "@/lib/redis";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [item] = await db.select().from(catalogueItems).where(eq(catalogueItems.id, parseInt(id)));
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const itemCopies = await db.select().from(copies).where(eq(copies.catalogueItemId, parseInt(id)));
  return NextResponse.json({ ...item, copies: itemCopies });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !["admin","librarian","staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const [updated] = await db
    .update(catalogueItems)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(catalogueItems.id, parseInt(id)))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await indexCatalogueItem(updated).catch(() => {});
  await invalidateCache("catalogue:*");
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !["admin"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await db.update(catalogueItems).set({ isActive: false }).where(eq(catalogueItems.id, parseInt(id)));
  await deleteCatalogueItem(parseInt(id)).catch(() => {});
  await invalidateCache("catalogue:*");
  return NextResponse.json({ success: true });
}
