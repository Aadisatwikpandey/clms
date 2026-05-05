import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  notifications, circTransactions, members, copies, catalogueItems, purchaseOrders, vendors,
} from "@/lib/db/schema";
import { eq, isNull, lt, and as drizzleAnd, sql, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { sendEmail, overdueReminderHtml } from "@/lib/email";
import { calculateFine } from "@/lib/utils/fine";
import { format } from "date-fns";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || !["admin","librarian"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(100);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !["admin","librarian"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { action } = await req.json();

  if (action === "send_overdues") {
    return sendOverdueReminders();
  }
  if (action === "send_vendor_reminders") {
    return sendVendorReminders();
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

async function sendOverdueReminders() {
  const today = new Date().toISOString().split("T")[0];

  const overdues = await db
    .select({
      memberId: circTransactions.memberId,
      memberName: members.name,
      memberEmail: members.email,
      dueDate: circTransactions.dueDate,
      title: catalogueItems.title,
      finePerDay: members.finePerDay,
    })
    .from(circTransactions)
    .innerJoin(members, eq(circTransactions.memberId, members.id))
    .innerJoin(copies, eq(circTransactions.copyId, copies.id))
    .innerJoin(catalogueItems, eq(copies.catalogueItemId, catalogueItems.id))
    .where(drizzleAnd(isNull(circTransactions.returnDate), sql`due_date < ${today}`, sql`transaction_type IN ('issue','overnight','renew')`));

  // Group by member
  const byMember = new Map<number, typeof overdues>();
  for (const row of overdues) {
    if (!byMember.has(row.memberId)) byMember.set(row.memberId, []);
    byMember.get(row.memberId)!.push(row);
  }

  let sent = 0;
  for (const [memberId, items] of byMember) {
    const member = items[0];
    if (!member.memberEmail) continue;

    const fineItems = items.map((i) => ({
      title: i.title,
      dueDate: format(new Date(i.dueDate!), "dd/MM/yyyy"),
      fine: String(calculateFine(i.dueDate!, new Date(), Number(i.finePerDay ?? 1))),
    }));
    const totalFine = fineItems.reduce((s, i) => s + Number(i.fine), 0);

    const html = overdueReminderHtml({ memberName: member.memberName, items: fineItems, totalFine: String(totalFine) });

    try {
      await sendEmail(member.memberEmail, "Library Overdue Notice – AMC Engineering College", html);
      await db.insert(notifications).values({
        memberId,
        type: "overdue",
        subject: "Library Overdue Notice",
        body: html,
        emailTo: member.memberEmail,
        sentAt: new Date(),
        isBulk: true,
      });
      sent++;
    } catch (err) {
      await db.insert(notifications).values({
        memberId,
        type: "overdue",
        subject: "Library Overdue Notice",
        body: html,
        emailTo: member.memberEmail,
        failedAt: new Date(),
        failReason: String(err),
        isBulk: true,
      });
    }
  }

  return NextResponse.json({ sent, total: byMember.size });
}

async function sendVendorReminders() {
  const pending = await db
    .select({ poNo: purchaseOrders.poNo, vendorEmail: vendors.email, vendorName: vendors.name, orderDate: purchaseOrders.orderDate })
    .from(purchaseOrders)
    .innerJoin(vendors, eq(purchaseOrders.vendorId, vendors.id))
    .where(drizzleAnd(sql`status IN ('sent','partial')`, sql`expected_delivery < current_date`));

  let sent = 0;
  for (const po of pending) {
    if (!po.vendorEmail) continue;
    const html = `<h2>Purchase Order Reminder</h2><p>PO No: ${po.poNo} is overdue. Please dispatch at the earliest.</p>`;
    try {
      await sendEmail(po.vendorEmail, `PO Reminder: ${po.poNo}`, html);
      sent++;
    } catch { /* log */ }
  }

  return NextResponse.json({ sent, total: pending.length });
}

