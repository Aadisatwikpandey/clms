import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  catalogueItems, members, copies, circTransactions, fineRecords,
  vendors, purchaseOrders, purchaseOrderItems, serials, serialIssues, libraryVisits,
} from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { parse } from "papaparse";
import { generateAccessionNo, generateCopyBarcode, generateMemberBarcode, generatePONo } from "@/lib/utils/barcode";
import { indexCatalogueItem, ensureIndices } from "@/lib/search/elasticsearch";
import { calculateFine } from "@/lib/utils/fine";
import { eq, or, sql } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !["admin"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File;
  const type = formData.get("type") as string;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const text = await file.text();
  const { data, errors } = parse(text, { header: true, skipEmptyLines: true });

  if (errors.length > 0) {
    return NextResponse.json({ error: "CSV parse errors", details: errors }, { status: 400 });
  }

  const rows = data as Record<string, string>[];
  const staffId = parseInt((session.user as any).id);

  const handlers: Record<string, (rows: Record<string, string>[]) => Promise<{ imported: unknown[]; failed: { row: unknown; error: string }[] }>> = {
    books: importBooks,
    members: importMembers,
    circulation: (r) => importCirculation(r, staffId),
    vendors: importVendors,
    "purchase-orders": importPurchaseOrders,
    serials: importSerials,
    "gate-visits": (r) => importGateVisits(r, staffId),
  };

  const handler = handlers[type];
  if (!handler) {
    return NextResponse.json({ error: `Invalid type. Use one of: ${Object.keys(handlers).join(", ")}` }, { status: 400 });
  }

  const { imported, failed } = await handler(rows);

  return NextResponse.json({
    total: rows.length,
    imported: imported.length,
    failed: failed.length,
    failures: failed.slice(0, 20),
  });
}

async function importBooks(rows: Record<string, string>[]) {
  await ensureIndices();
  const imported: string[] = [];
  const failed: { row: unknown; error: string }[] = [];

  for (const row of rows) {
    try {
      const [{ maxSeq }] = await db.select({ maxSeq: sql<number>`coalesce(max(id), 0)` }).from(catalogueItems);
      const year = new Date().getFullYear();
      const accessionNo = row["accession_no"] || generateAccessionNo(year, Number(maxSeq) + 1);
      const qty = parseInt(row["copies"] ?? "1");

      const [item] = await db.insert(catalogueItems).values({
        accessionNo,
        title: row["title"] ?? "Unknown",
        authors: row["authors"] ? [row["authors"]] : [],
        publisher: row["publisher"],
        publicationYear: row["year"] ? parseInt(row["year"]) : undefined,
        isbn: row["isbn"],
        deweyNo: row["dewey_no"] ?? row["class_no"],
        callNumber: row["call_no"],
        subjects: row["subjects"] ? row["subjects"].split(";").map((s) => s.trim()) : [],
        language: row["language"] ?? "English",
        price: row["price"],
        location: row["location"],
        totalCopies: qty,
        availableCopies: qty,
      }).onConflictDoNothing().returning();

      if (item) {
        const copyRows = Array.from({ length: qty }, (_, i) => ({
          catalogueItemId: item.id,
          barcode: generateCopyBarcode(accessionNo, i + 1),
          copyNo: i + 1,
        }));
        await db.insert(copies).values(copyRows).onConflictDoNothing();
        await indexCatalogueItem(item).catch(() => {});
        imported.push(accessionNo);
      }
    } catch (err) {
      failed.push({ row, error: String(err) });
    }
  }
  return { imported, failed };
}

async function importMembers(rows: Record<string, string>[]) {
  const imported: string[] = [];
  const failed: { row: unknown; error: string }[] = [];

  for (const row of rows) {
    try {
      const [{ maxSeq }] = await db.select({ maxSeq: sql<number>`coalesce(max(id), 0)` }).from(members);
      const year = new Date().getFullYear();
      const membershipNo = row["membership_no"] || `AMC/${year}/${String(Number(maxSeq) + 1).padStart(5, "0")}`;
      const barcode = row["roll_no"] || generateMemberBarcode(membershipNo);

      const [inserted] = await db.insert(members).values({
        membershipNo,
        barcode,
        name: row["name"] ?? "Unknown",
        memberType: (row["type"] as any) ?? "student",
        department: row["department"],
        course: row["course"],
        rollNo: row["roll_no"],
        email: row["email"],
        phone: row["phone"],
      }).onConflictDoNothing().returning({ id: members.id });

      if (inserted) {
        imported.push(membershipNo);
      } else {
        failed.push({ row, error: `Skipped — USN "${row["roll_no"]}" or membership no. already exists` });
      }
    } catch (err) {
      failed.push({ row, error: String(err) });
    }
  }
  return { imported, failed };
}

// CSV: member_barcode, copy_barcode, issue_date, due_date, return_date (optional — blank means still on loan)
async function importCirculation(rows: Record<string, string>[], staffId: number) {
  const imported: number[] = [];
  const failed: { row: unknown; error: string }[] = [];

  for (const row of rows) {
    try {
      const [member] = await db.select().from(members)
        .where(or(eq(members.barcode, row["member_barcode"]), eq(members.rollNo, row["member_barcode"])));
      if (!member) { failed.push({ row, error: `Member ${row["member_barcode"]} not found` }); continue; }

      const [copy] = await db.select().from(copies).where(eq(copies.barcode, row["copy_barcode"]));
      if (!copy) { failed.push({ row, error: `Copy ${row["copy_barcode"]} not found` }); continue; }

      const issueDate = new Date(row["issue_date"]);
      const dueDate = row["due_date"];
      const returnDate = row["return_date"] ? new Date(row["return_date"]) : null;
      const fineAmount = returnDate && dueDate ? calculateFine(dueDate, returnDate, Number(member.finePerDay ?? 1)) : 0;

      const [txn] = await db.insert(circTransactions).values({
        memberId: member.id,
        copyId: copy.id,
        transactionType: "issue",
        issueDate,
        dueDate,
        returnDate,
        fineAmount: String(fineAmount),
        fineStatus: fineAmount > 0 ? "pending" : "paid",
        staffId,
      }).returning();

      if (returnDate) {
        await db.update(copies).set({ status: "available" }).where(eq(copies.id, copy.id));
      } else {
        await db.update(copies).set({ status: "issued" }).where(eq(copies.id, copy.id));
        await db.update(catalogueItems).set({ availableCopies: sql`greatest(available_copies - 1, 0)` }).where(eq(catalogueItems.id, copy.catalogueItemId));
      }

      if (fineAmount > 0) {
        await db.insert(fineRecords).values({
          memberId: member.id,
          transactionId: txn.id,
          amount: String(fineAmount),
          reason: `Overdue fine for copy ${row["copy_barcode"]}`,
        });
        await db.update(members).set({ totalFinesDue: sql`total_fines_due + ${fineAmount}` }).where(eq(members.id, member.id));
      }

      imported.push(txn.id);
    } catch (err) {
      failed.push({ row, error: String(err) });
    }
  }
  return { imported, failed };
}

// CSV: name, code, contact_person, email, phone, city, gst_no
async function importVendors(rows: Record<string, string>[]) {
  const imported: string[] = [];
  const failed: { row: unknown; error: string }[] = [];

  for (const row of rows) {
    try {
      const [vendor] = await db.insert(vendors).values({
        name: row["name"] ?? "Unknown Vendor",
        code: row["code"] || undefined,
        contactPerson: row["contact_person"],
        email: row["email"],
        phone: row["phone"],
        city: row["city"],
        gstNo: row["gst_no"],
      }).returning();
      imported.push(vendor.name);
    } catch (err) {
      failed.push({ row, error: String(err) });
    }
  }
  return { imported, failed };
}

// CSV: vendor_name, order_date, expected_delivery, status, item_title, quantity, unit_price, discount
// One row = one purchase order with a single line item (keeps the CSV flat).
async function importPurchaseOrders(rows: Record<string, string>[]) {
  const imported: string[] = [];
  const failed: { row: unknown; error: string }[] = [];

  for (const row of rows) {
    try {
      const [vendor] = await db.select().from(vendors).where(sql`lower(${vendors.name}) = lower(${row["vendor_name"]})`);
      if (!vendor) { failed.push({ row, error: `Vendor "${row["vendor_name"]}" not found — import vendors first` }); continue; }

      const [{ maxSeq }] = await db.select({ maxSeq: sql<number>`coalesce(max(id), 0)` }).from(purchaseOrders);
      const orderDate = new Date(row["order_date"]);
      const poNo = generatePONo(orderDate.getFullYear(), Number(maxSeq) + 1);

      const quantity = parseInt(row["quantity"] ?? "1");
      const unitPrice = Number(row["unit_price"] ?? "0");
      const discount = Number(row["discount"] ?? "0");
      const gross = unitPrice * quantity;
      const totalAmount = gross - (gross * discount) / 100;

      const [po] = await db.insert(purchaseOrders).values({
        poNo,
        vendorId: vendor.id,
        orderDate: row["order_date"],
        expectedDelivery: row["expected_delivery"] || undefined,
        status: (row["status"] as any) || "sent",
        totalAmount: String(totalAmount),
      }).returning();

      await db.insert(purchaseOrderItems).values({
        purchaseOrderId: po.id,
        title: row["item_title"] ?? "Unknown",
        quantity,
        unitPrice: String(unitPrice),
        discount: String(discount),
        totalPrice: String(totalAmount),
      });

      imported.push(poNo);
    } catch (err) {
      failed.push({ row, error: String(err) });
    }
  }
  return { imported, failed };
}

// CSV: serial_title, issn, publisher, frequency, volume, issue_no, expected_date, received_date (optional), status
async function importSerials(rows: Record<string, string>[]) {
  const imported: number[] = [];
  const failed: { row: unknown; error: string }[] = [];
  const serialCache = new Map<string, number>();

  for (const row of rows) {
    try {
      const titleKey = row["serial_title"]?.toLowerCase();
      if (!titleKey) { failed.push({ row, error: "serial_title required" }); continue; }

      let serialId = serialCache.get(titleKey);
      if (!serialId) {
        const [existing] = await db.select().from(serials).where(sql`lower(${serials.title}) = ${titleKey}`);
        if (existing) {
          serialId = existing.id;
        } else {
          const [created] = await db.insert(serials).values({
            title: row["serial_title"],
            issn: row["issn"],
            publisher: row["publisher"],
            frequency: (row["frequency"] as any) || "monthly",
          }).returning();
          serialId = created.id;
        }
        serialCache.set(titleKey, serialId);
      }

      const [issue] = await db.insert(serialIssues).values({
        serialId,
        volume: row["volume"] ? parseInt(row["volume"]) : undefined,
        issueNo: row["issue_no"],
        expectedDate: row["expected_date"] || undefined,
        receivedDate: row["received_date"] || undefined,
        status: (row["status"] as any) || (row["received_date"] ? "received" : "expected"),
      }).returning();

      imported.push(issue.id);
    } catch (err) {
      failed.push({ row, error: String(err) });
    }
  }
  return { imported, failed };
}

// CSV: member_barcode, entry_time, exit_time (optional)
async function importGateVisits(rows: Record<string, string>[], staffId: number) {
  const imported: number[] = [];
  const failed: { row: unknown; error: string }[] = [];

  for (const row of rows) {
    try {
      const [member] = await db.select().from(members)
        .where(or(eq(members.barcode, row["member_barcode"]), eq(members.rollNo, row["member_barcode"])));
      if (!member) { failed.push({ row, error: `Member ${row["member_barcode"]} not found` }); continue; }

      const entryTime = new Date(row["entry_time"]);
      const exitTime = row["exit_time"] ? new Date(row["exit_time"]) : null;
      const durationMinutes = exitTime ? Math.round((exitTime.getTime() - entryTime.getTime()) / 60000) : null;

      const [visit] = await db.insert(libraryVisits).values({
        memberId: member.id,
        entryTime,
        exitTime,
        durationMinutes,
        scannedBy: staffId,
      }).returning();

      imported.push(visit.id);
    } catch (err) {
      failed.push({ row, error: String(err) });
    }
  }
  return { imported, failed };
}
