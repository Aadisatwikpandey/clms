import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { circTransactions, members, copies, catalogueItems } from "@/lib/db/schema";
import { eq, isNull, lt, sql, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { calculateFine } from "@/lib/utils/fine";

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session || !["admin","librarian","staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().split("T")[0];

  const overdues = await db
    .select({
      txnId: circTransactions.id,
      memberId: circTransactions.memberId,
      memberName: members.name,
      memberEmail: members.email,
      membershipNo: members.membershipNo,
      dueDate: circTransactions.dueDate,
      issueDate: circTransactions.issueDate,
      copyBarcode: copies.barcode,
      title: catalogueItems.title,
      finePerDay: members.finePerDay,
    })
    .from(circTransactions)
    .innerJoin(members, eq(circTransactions.memberId, members.id))
    .innerJoin(copies, eq(circTransactions.copyId, copies.id))
    .innerJoin(catalogueItems, eq(copies.catalogueItemId, catalogueItems.id))
    .where(and(isNull(circTransactions.returnDate), lt(circTransactions.dueDate, today), sql`transaction_type IN ('issue','overnight','renew')`));

  const result = overdues.map((row) => ({
    ...row,
    daysOverdue: Math.floor((Date.now() - new Date(row.dueDate!).getTime()) / 86400000),
    fineAmount: calculateFine(row.dueDate!, new Date(), Number(row.finePerDay ?? 1)),
  }));

  return NextResponse.json(result);
}

