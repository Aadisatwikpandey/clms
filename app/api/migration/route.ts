import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { catalogueItems, members, copies } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { parse } from "papaparse";
import { generateAccessionNo, generateCopyBarcode, generateMemberBarcode } from "@/lib/utils/barcode";
import { sql } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !["admin"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File;
  const type = formData.get("type") as string; // "books" | "members"

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const text = await file.text();
  const { data, errors } = parse(text, { header: true, skipEmptyLines: true });

  if (errors.length > 0) {
    return NextResponse.json({ error: "CSV parse errors", details: errors }, { status: 400 });
  }

  const rows = data as Record<string, string>[];
  const imported = [];
  const failed = [];

  if (type === "books") {
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
          imported.push(accessionNo);
        }
      } catch (err) {
        failed.push({ row, error: String(err) });
      }
    }
  } else if (type === "members") {
    for (const row of rows) {
      try {
        const [{ maxSeq }] = await db.select({ maxSeq: sql<number>`coalesce(max(id), 0)` }).from(members);
        const year = new Date().getFullYear();
        const membershipNo = row["membership_no"] || `AMC/${year}/${String(Number(maxSeq) + 1).padStart(5, "0")}`;
        const barcode = generateMemberBarcode(membershipNo);

        await db.insert(members).values({
          membershipNo,
          barcode,
          name: row["name"] ?? "Unknown",
          memberType: (row["type"] as any) ?? "student",
          department: row["department"],
          course: row["course"],
          rollNo: row["roll_no"],
          email: row["email"],
          phone: row["phone"],
        }).onConflictDoNothing();

        imported.push(membershipNo);
      } catch (err) {
        failed.push({ row, error: String(err) });
      }
    }
  } else {
    return NextResponse.json({ error: "Invalid type. Use 'books' or 'members'" }, { status: 400 });
  }

  return NextResponse.json({
    total: rows.length,
    imported: imported.length,
    failed: failed.length,
    failures: failed.slice(0, 20),
  });
}
