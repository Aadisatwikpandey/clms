import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { purchaseOrders, purchaseOrderItems, budgetHeads } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { generatePONo } from "@/lib/utils/barcode";

const poItemSchema = z.object({
  title: z.string(),
  authors: z.string().optional(),
  isbn: z.string().optional(),
  quantity: z.number().int().min(1),
  unitPrice: z.string(),
  discount: z.string().default("0"),
  requisitionId: z.number().int().optional(),
});

const poSchema = z.object({
  vendorId: z.number().int(),
  orderDate: z.string(),
  expectedDelivery: z.string().optional(),
  currency: z.string().default("INR"),
  budgetHeadId: z.number().int().optional(),
  notes: z.string().optional(),
  items: z.array(poItemSchema).min(1),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || !["admin","librarian","finance"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orders = await db.select().from(purchaseOrders).orderBy(desc(purchaseOrders.createdAt)).limit(50);
  return NextResponse.json(orders);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !["admin","librarian"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = poSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });

  const { items, ...orderData } = parsed.data;
  const [{ maxSeq }] = await db.select({ maxSeq: sql<number>`coalesce(max(id), 0)` }).from(purchaseOrders);
  const year = new Date().getFullYear();
  const poNo = generatePONo(year, Number(maxSeq) + 1);

  const totalAmount = items.reduce((sum, item) => {
    const gross = Number(item.unitPrice) * item.quantity;
    const net = gross - (gross * Number(item.discount) / 100);
    return sum + net;
  }, 0);

  const [po] = await db.insert(purchaseOrders).values({
    ...orderData,
    poNo,
    totalAmount: String(totalAmount),
  }).returning();

  const itemRows = items.map((item) => {
    const gross = Number(item.unitPrice) * item.quantity;
    const net = gross - (gross * Number(item.discount) / 100);
    return { ...item, purchaseOrderId: po.id, totalPrice: String(net), discount: item.discount };
  });
  await db.insert(purchaseOrderItems).values(itemRows);

  // Deduct from budget if head specified
  if (orderData.budgetHeadId) {
    await db
      .update(budgetHeads)
      .set({ spentAmount: sql`spent_amount + ${totalAmount}` })
      .where(eq(budgetHeads.id, orderData.budgetHeadId));
  }

  return NextResponse.json(po, { status: 201 });
}
