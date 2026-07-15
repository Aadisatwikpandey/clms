import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { purchaseOrders, purchaseOrderItems, budgetHeads, vendors } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { z } from "zod";

const updateSchema = z.object({
  status: z.enum(["draft", "approved", "sent", "partial", "received", "cancelled"]),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !["admin", "librarian", "finance"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [po] = await db
    .select({
      id: purchaseOrders.id, poNo: purchaseOrders.poNo, orderDate: purchaseOrders.orderDate,
      expectedDelivery: purchaseOrders.expectedDelivery, status: purchaseOrders.status,
      totalAmount: purchaseOrders.totalAmount, currency: purchaseOrders.currency,
      invoiceNo: purchaseOrders.invoiceNo, invoiceDate: purchaseOrders.invoiceDate,
      invoiceAmount: purchaseOrders.invoiceAmount, paidAmount: purchaseOrders.paidAmount,
      notes: purchaseOrders.notes, createdAt: purchaseOrders.createdAt,
      vendorId: vendors.id, vendorName: vendors.name, vendorEmail: vendors.email,
      vendorPhone: vendors.phone, vendorCity: vendors.city, vendorGst: vendors.gstNo,
      budgetHeadId: budgetHeads.id, budgetHeadName: budgetHeads.name, budgetHeadCode: budgetHeads.code,
    })
    .from(purchaseOrders)
    .innerJoin(vendors, eq(purchaseOrders.vendorId, vendors.id))
    .leftJoin(budgetHeads, eq(purchaseOrders.budgetHeadId, budgetHeads.id))
    .where(eq(purchaseOrders.id, parseInt(id)));

  if (!po) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const items = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, parseInt(id)));

  return NextResponse.json({ ...po, items });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !["admin", "librarian"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });

  const [existing] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, parseInt(id)));
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (existing.status === "cancelled") {
    return NextResponse.json({ error: "This order is already cancelled" }, { status: 400 });
  }
  if (existing.status === "received" && parsed.data.status === "cancelled") {
    return NextResponse.json({ error: "Cannot cancel an order that has already been received" }, { status: 400 });
  }

  const [updated] = await db
    .update(purchaseOrders)
    .set({ status: parsed.data.status, updatedAt: new Date() })
    .where(eq(purchaseOrders.id, parseInt(id)))
    .returning();

  // Cancelling releases any budget that was reserved against this order.
  if (parsed.data.status === "cancelled" && existing.budgetHeadId) {
    await db
      .update(budgetHeads)
      .set({ spentAmount: sql`spent_amount - ${existing.totalAmount}` })
      .where(eq(budgetHeads.id, existing.budgetHeadId));
  }

  return NextResponse.json(updated);
}
