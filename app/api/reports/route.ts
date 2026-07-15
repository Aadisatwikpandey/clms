import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  circTransactions, catalogueItems, members, fineRecords,
  purchaseOrders, copies, serialIssues, libraryVisits,
} from "@/lib/db/schema";
import { eq, sql, gte, lte, and as drizzleAnd, isNull, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getCached } from "@/lib/redis";
import { closeStaleVisits } from "@/lib/gate";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || !["admin","librarian","staff","finance"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "dashboard";
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const cacheKey = `report:${type}:${from}:${to}`;

  const result = await getCached(cacheKey, 300, async () => {
    switch (type) {
      case "dashboard": return getDashboardStats();
      case "circulation": return getCirculationStats(from, to);
      case "fines": return getFineStats(from, to);
      case "acquisitions": return getAcquisitionsStats(from, to);
      case "top-books": return getTopBooks(from, to);
      case "top-members": return getTopMembers(from, to);
      case "missing-serials": return getMissingSerials();
      case "gate": return getGateStats(from, to);
      default: return {};
    }
  });

  return NextResponse.json(result);
}

async function getDashboardStats() {
  await closeStaleVisits();

  const [
    [{ totalBooks }],
    [{ totalMembers }],
    [{ activeLoans }],
    [{ overdueLoans }],
    [{ totalFinesPending }],
    [{ newArrivals }],
    [{ currentlyInside }],
  ] = await Promise.all([
    db.select({ totalBooks: sql<number>`count(*)` }).from(catalogueItems).where(eq(catalogueItems.isActive, true)),
    db.select({ totalMembers: sql<number>`count(*)` }).from(members).where(eq(members.isActive, true)),
    db.select({ activeLoans: sql<number>`count(*)` }).from(circTransactions).where(drizzleAnd(isNull(circTransactions.returnDate), sql`transaction_type IN ('issue','overnight','renew')`)),
    db.select({ overdueLoans: sql<number>`count(*)` }).from(circTransactions).where(drizzleAnd(isNull(circTransactions.returnDate), sql`due_date < current_date`, sql`transaction_type IN ('issue','overnight','renew')`)),
    db.select({ totalFinesPending: sql<number>`coalesce(sum(amount),0)` }).from(fineRecords).where(eq(fineRecords.status, "pending")),
    db.select({ newArrivals: sql<number>`count(*)` }).from(catalogueItems).where(sql`created_at >= now() - interval '30 days'`),
    db.select({ currentlyInside: sql<number>`count(*)` }).from(libraryVisits).where(isNull(libraryVisits.exitTime)),
  ]);

  return { totalBooks, totalMembers, activeLoans, overdueLoans, totalFinesPending, newArrivals, currentlyInside };
}

async function getCirculationStats(from: string | null, to: string | null) {
  const conditions: any[] = [sql`transaction_type = 'issue'`];
  if (from) conditions.push(gte(circTransactions.issueDate, new Date(from)));
  if (to) conditions.push(lte(circTransactions.issueDate, new Date(to)));

  const daily = await db
    .select({
      date: sql<string>`date(issue_date)`,
      count: sql<number>`count(*)`,
    })
    .from(circTransactions)
    .where(drizzleAnd(...conditions))
    .groupBy(sql`date(issue_date)`)
    .orderBy(sql`date(issue_date)`);

  const byType = await db
    .select({ type: circTransactions.transactionType, count: sql<number>`count(*)` })
    .from(circTransactions)
    .groupBy(circTransactions.transactionType);

  return { daily, byType };
}

async function getFineStats(from: string | null, to: string | null) {
  const conditions: any[] = [];
  if (from) conditions.push(gte(fineRecords.createdAt, new Date(from)));
  if (to) conditions.push(lte(fineRecords.createdAt, new Date(to)));

  const [
    [{ pending }], [{ collected }], monthly
  ] = await Promise.all([
    db.select({ pending: sql<number>`coalesce(sum(amount),0)` }).from(fineRecords).where(drizzleAnd(...conditions, eq(fineRecords.status, "pending"))),
    db.select({ collected: sql<number>`coalesce(sum(amount),0)` }).from(fineRecords).where(drizzleAnd(...conditions, eq(fineRecords.status, "paid"))),
    db.select({
      month: sql<string>`to_char(created_at, 'Mon YYYY')`,
      amount: sql<number>`sum(amount)`,
    }).from(fineRecords).where(drizzleAnd(...conditions)).groupBy(sql`to_char(created_at, 'Mon YYYY')`),
  ]);

  return { pending, collected, monthly };
}

async function getAcquisitionsStats(from: string | null, to: string | null) {
  const conditions: any[] = [];
  if (from) conditions.push(gte(purchaseOrders.orderDate, from as any));
  if (to) conditions.push(lte(purchaseOrders.orderDate, to as any));

  const byStatus = await db
    .select({ status: purchaseOrders.status, count: sql<number>`count(*)`, total: sql<number>`sum(total_amount)` })
    .from(purchaseOrders)
    .where(conditions.length ? drizzleAnd(...conditions) : undefined)
    .groupBy(purchaseOrders.status);

  return { byStatus };
}

async function getTopBooks(from: string | null, to: string | null) {
  const conditions: any[] = [sql`transaction_type = 'issue'`];
  if (from) conditions.push(gte(circTransactions.issueDate, new Date(from)));
  if (to) conditions.push(lte(circTransactions.issueDate, new Date(to)));

  const rows = await db
    .select({
      title: catalogueItems.title,
      count: sql<number>`count(*)`,
    })
    .from(circTransactions)
    .innerJoin(copies, eq(circTransactions.copyId, copies.id))
    .innerJoin(catalogueItems, eq(copies.catalogueItemId, catalogueItems.id))
    .where(drizzleAnd(...conditions))
    .groupBy(catalogueItems.title)
    .orderBy(desc(sql`count(*)`))
    .limit(10);

  return rows;
}

async function getTopMembers(from: string | null, to: string | null) {
  const conditions: any[] = [sql`transaction_type = 'issue'`];
  if (from) conditions.push(gte(circTransactions.issueDate, new Date(from)));
  if (to) conditions.push(lte(circTransactions.issueDate, new Date(to)));

  const rows = await db
    .select({
      name: members.name,
      department: members.department,
      count: sql<number>`count(*)`,
    })
    .from(circTransactions)
    .innerJoin(members, eq(circTransactions.memberId, members.id))
    .where(drizzleAnd(...conditions))
    .groupBy(members.name, members.department)
    .orderBy(desc(sql`count(*)`))
    .limit(10);

  return rows;
}

async function getMissingSerials() {
  const rows = await db
    .select({ status: serialIssues.status, count: sql<number>`count(*)` })
    .from(serialIssues)
    .groupBy(serialIssues.status);
  return rows;
}

async function getGateStats(from: string | null, to: string | null) {
  await closeStaleVisits();

  const conditions: any[] = [];
  if (from) conditions.push(gte(libraryVisits.entryTime, new Date(from)));
  if (to) conditions.push(lte(libraryVisits.entryTime, new Date(to)));
  const where = conditions.length ? drizzleAnd(...conditions) : undefined;

  const [daily, byHour, byDept, [{ avgDuration }]] = await Promise.all([
    db.select({
      date: sql<string>`date(entry_time)`,
      count: sql<number>`count(*)`,
    }).from(libraryVisits).where(where).groupBy(sql`date(entry_time)`).orderBy(sql`date(entry_time)`),

    db.select({
      hour: sql<number>`extract(hour from entry_time)`,
      count: sql<number>`count(*)`,
    }).from(libraryVisits).where(where).groupBy(sql`extract(hour from entry_time)`).orderBy(sql`extract(hour from entry_time)`),

    db.select({
      department: members.department,
      count: sql<number>`count(*)`,
    })
      .from(libraryVisits)
      .innerJoin(members, eq(libraryVisits.memberId, members.id))
      .where(where)
      .groupBy(members.department)
      .orderBy(desc(sql`count(*)`))
      .limit(10),

    db.select({ avgDuration: sql<number>`coalesce(avg(duration_minutes),0)` })
      .from(libraryVisits)
      .where(drizzleAnd(...(where ? [where] : []), sql`duration_minutes IS NOT NULL`)),
  ]);

  return { daily, byHour, byDept, avgDuration: Number(avgDuration) };
}

