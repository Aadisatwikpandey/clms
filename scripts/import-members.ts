import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import fs from "fs";
import { parse } from "csv-parse/sync";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../lib/db/schema";

const conn = postgres(process.env.DATABASE_URL!);
const db = drizzle(conn, { schema });

const FILE = "/Users/aadi/Desktop/AMC-lib-system/members.csv";

function s(v: unknown): string { return v == null ? "" : String(v).trim(); }
function sOrNull(v: unknown): string | null { const r = s(v); return r || null; }

function toMemberType(t: string): (typeof schema.memberTypeEnum.enumValues)[number] {
  const v = t.toLowerCase();
  if (v === "faculty") return "faculty";
  if (v === "staff") return "staff";
  if (v === "external") return "external";
  return "student";
}

async function main() {
  console.log("📖 Reading members CSV...");
  const raw = fs.readFileSync(FILE, "utf8");
  const records: Record<string, string>[] = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`   Total rows: ${records.length}`);

  let inserted = 0, skipped = 0;

  for (const row of records) {
    const email = sOrNull(row["email"]);

    if (!s(row["name"])) { skipped++; continue; }

    // USN (roll_no) is the sole identifier — used as both membershipNo and barcode
    const usn = s(row["roll_no"]);
    if (!usn) { skipped++; continue; }

    await db.insert(schema.members).values({
      name: s(row["name"]),
      memberType: toMemberType(s(row["type"])),
      department: sOrNull(row["department"]),
      course: sOrNull(row["course"]),
      rollNo: usn,
      email,
      phone: sOrNull(row["phone"]),
      membershipNo: usn,
      barcode: usn,
    }).onConflictDoNothing();

    inserted++;
    if (inserted % 500 === 0) process.stdout.write(`\r   Inserted: ${inserted}...`);
  }

  console.log(`\n✅ Done. Inserted: ${inserted}, Skipped: ${skipped}`);
  await conn.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
