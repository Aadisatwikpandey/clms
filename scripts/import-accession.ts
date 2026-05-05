import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import fs from "fs";
import { parse } from "csv-parse/sync";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../lib/db/schema";
import { eq, sql } from "drizzle-orm";

const conn = postgres(process.env.DATABASE_URL!);
const db = drizzle(conn, { schema });

const CSV_FILE = "/Users/aadi/Desktop/AMC-lib-system/Accession Report as Bill date 1999-2025.csv";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function s(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

function sOrNull(v: unknown): string | null {
  const r = s(v); return r || null;
}

function splitList(v: unknown): string[] {
  const r = s(v); if (!r) return [];
  return r.split(/[;,]/).map((x) => x.trim()).filter(Boolean);
}

function parseYear(v: unknown): number | null {
  const n = parseInt(s(v)); return (isNaN(n) || n < 1900 || n > 2100) ? null : n;
}

function parseDecimal(v: unknown): string | null {
  const n = parseFloat(s(v).replace(/[^0-9.]/g, ""));
  return isNaN(n) ? null : n.toFixed(2);
}

function parseDate(v: unknown): string | null {
  const r = s(v); if (!r) return null;
  // "May 30 2001 12:00AM" or "Feb 06 2025 12:00AM"
  const d = new Date(r);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
}

function parsePages(v: unknown): number | null {
  const n = parseInt(s(v)); return isNaN(n) ? null : n;
}

function toMaterialType(itemType: string): schema.materialTypeEnum {
  const t = itemType.toLowerCase();
  if (t.includes("journal") || t.includes("periodical") || t.includes("magazine")) return "journal";
  if (t.includes("dvd") || t.includes("cd") || t.includes("media") || t.includes("av")) return "av_material";
  if (t.includes("thesis") || t.includes("dissertation")) return "thesis";
  if (t.includes("map")) return "map";
  if (t.includes("manuscript")) return "manuscript";
  if (t.includes("newspaper")) return "newspaper";
  return "book";
}

function toCopyStatus(accessionStatus: string): schema.copyStatusEnum {
  const t = accessionStatus.toLowerCase();
  if (t.includes("withdraw")) return "withdrawn";
  if (t.includes("lost")) return "lost";
  if (t.includes("binding")) return "in_binding";
  return "available";
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("📖 Reading CSV...");
  const raw = fs.readFileSync(CSV_FILE, "utf8");

  // File has 6 preamble lines before the header row
  const lines = raw.split(/\r?\n/);
  const dataLines = lines.slice(6).join("\n"); // row 7 onward = header + data

  const records: Record<string, string>[] = parse(dataLines, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    trim: true,
  });

  // Filter out rows with no accession number
  const rows = records.filter((r) => s(r["Accn No"]));
  console.log(`   Total copy rows: ${rows.length}`);

  // Group by Title No → one catalogue item per unique title
  const titleMap = new Map<string, Record<string, string>[]>();
  for (const row of rows) {
    const titleNo = s(row["Title No"]) || s(row["Accn No"]);
    if (!titleMap.has(titleNo)) titleMap.set(titleNo, []);
    titleMap.get(titleNo)!.push(row);
  }
  console.log(`   Unique titles:   ${titleMap.size}`);

  let itemsInserted = 0;
  let copiesInserted = 0;
  const BATCH = 200;
  const titleEntries = [...titleMap.entries()];

  for (let b = 0; b < titleEntries.length; b += BATCH) {
    const batch = titleEntries.slice(b, b + BATCH);

    await db.transaction(async (tx) => {
      for (const [titleNo, copyRows] of batch) {
        const rep = copyRows[0];

        const title = sOrNull(rep["Title"]);
        if (!title) continue;

        // Check if already imported
        const accNo = s(rep["Accn No"]);
        const existing = await tx
          .select({ id: schema.catalogueItems.id })
          .from(schema.catalogueItems)
          .where(eq(schema.catalogueItems.accessionNo, accNo))
          .limit(1);

        let itemId: number;

        if (existing.length > 0) {
          itemId = existing[0].id;
        } else {
          // Build subjects array (Subject + Subject 2, strip class codes in parens)
          const subjects: string[] = [];
          const sub1 = s(rep["Subject"]).replace(/\(.*?\)/g, "").trim();
          const sub2 = s(rep["Subject 2"]).replace(/\(.*?\)/g, "").trim();
          if (sub1) subjects.push(sub1);
          if (sub2 && sub2 !== sub1) subjects.push(sub2);

          const [item] = await tx.insert(schema.catalogueItems).values({
            accessionNo: accNo,
            titleNo: sOrNull(rep["Title No"]),
            title,
            subtitle: sOrNull(rep["Sub Title"]),
            materialType: toMaterialType(s(rep["Item Type"])),
            category: sOrNull(rep["Category"]),
            authors: splitList(rep["Authors"]),
            editors: splitList(rep["Editor"]),
            guide: sOrNull(rep["Guide"]),
            publisher: sOrNull(rep["Publisher"]),
            publicationYear: parseYear(rep["Published Year"]),
            publicationPlace: sOrNull(rep["Published Place"]),
            edition: sOrNull(rep["Edition"]),
            volume: sOrNull(rep["Volume"]),
            series: sOrNull(rep["Series"]),
            isbn: sOrNull(rep["ISBN"]),
            deweyNo: sOrNull(rep["Class No"]),
            callNumber: sOrNull(rep["Call No"]),
            subjects,
            keywords: splitList(rep["Keywords"]),
            language: sOrNull(rep["Language"]) ?? "English",
            pages: parsePages(rep["No of Pages"]),
            bindingType: sOrNull(rep["Binding Type"]),
            department: sOrNull(rep["Department"]),
            source: sOrNull(rep["Source"]),
            vendorName: sOrNull(rep["Vendor"]),
            price: parseDecimal(rep["Price"]),
            cost: parseDecimal(rep["Cost"]),
            netCost: parseDecimal(rep["Net Cost"]),
            currency: sOrNull(rep["Currency"]) ?? "INR",
            percentDiscount: parseDecimal(rep["Percent Discont"]),
            billDate: parseDate(rep["Bill Date"]),
            billNo: sOrNull(rep["Bill No"]),
            entryDate: parseDate(rep["Entry Date"]),
            location: sOrNull(rep["Location"]),
            section: sOrNull(rep["Section"]),
            homeBranch: sOrNull(rep["Home Branch"]),
            currentBranch: sOrNull(rep["Current Branch"]),
            accessionStatus: sOrNull(rep["Accession Status"]),
            softCopyPath: sOrNull(rep["Soft Copy Path"]),
            softCopyPicPath: sOrNull(rep["Soft Copy Pic Path"]),
            custField1: sOrNull(rep["Cust Field1"]),
            custField2: sOrNull(rep["Cust Field2"]),
            custField3: sOrNull(rep["Cust Field3"]),
            custField4: sOrNull(rep["Cust Field4"]),
            remarks: sOrNull(rep["Remarks"]),
            totalCopies: 0,
            availableCopies: 0,
          }).returning({ id: schema.catalogueItems.id });

          itemId = item.id;
          itemsInserted++;
        }

        // Insert each physical copy
        for (const row of copyRows) {
          const barcode = s(row["Accn No"]);
          if (!barcode) continue;

          const existingCopy = await tx
            .select({ id: schema.copies.id })
            .from(schema.copies)
            .where(eq(schema.copies.barcode, barcode))
            .limit(1);
          if (existingCopy.length > 0) continue;

          await tx.insert(schema.copies).values({
            catalogueItemId: itemId,
            barcode,
            status: toCopyStatus(s(row["Accession Status"])),
            location: sOrNull(row["Location"]) ?? sOrNull(row["Home Branch"]),
            purchasePrice: parseDecimal(row["Price"]),
            purchaseDate: parseDate(row["Bill Date"]),
          });
          copiesInserted++;
        }

        // Sync counts
        await tx
          .update(schema.catalogueItems)
          .set({
            totalCopies: sql`(select count(*) from copies where catalogue_item_id = ${itemId})`,
            availableCopies: sql`(select count(*) from copies where catalogue_item_id = ${itemId} and status = 'available')`,
          })
          .where(eq(schema.catalogueItems.id, itemId));
      }
    });

    const done = Math.min(b + BATCH, titleEntries.length);
    process.stdout.write(
      `\r   Progress: ${done}/${titleEntries.length} titles (${itemsInserted} items, ${copiesInserted} copies)...`
    );
  }

  console.log(`\n✅ Done.`);
  console.log(`   Catalogue items inserted : ${itemsInserted}`);
  console.log(`   Copies inserted          : ${copiesInserted}`);
  await conn.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
