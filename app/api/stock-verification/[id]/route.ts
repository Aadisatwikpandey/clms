import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stockSessions, stockVerifications, copies, catalogueItems } from "@/lib/db/schema";
import { eq, and, notInArray, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !["admin", "librarian", "staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const sessionId = parseInt(id);

  const [stockSession] = await db.select().from(stockSessions).where(eq(stockSessions.id, sessionId));
  if (!stockSession) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const verifiedCopyIds = db
    .select({ copyId: stockVerifications.copyId })
    .from(stockVerifications)
    .where(eq(stockVerifications.sessionId, sessionId));

  const missing = await db
    .select({
      copyId: copies.id,
      barcode: copies.barcode,
      title: catalogueItems.title,
      location: copies.location,
    })
    .from(copies)
    .innerJoin(catalogueItems, eq(copies.catalogueItemId, catalogueItems.id))
    .where(and(eq(copies.isActive, true), notInArray(copies.id, verifiedCopyIds)));

  return NextResponse.json({ session: stockSession, missing });
}
