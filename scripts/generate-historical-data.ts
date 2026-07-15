// Generates backdated CSVs (circulation, vendors, purchase-orders, serials, gate-visits)
// for the new /api/migration import types, so Reports/Dashboard/Gate charts have a
// realistic multi-month spread of data instead of being empty. Reads real member/copy
// barcodes from Postgres (can't invent IDs — the import validates against real rows).
//
// Usage: npx tsx scripts/generate-historical-data.ts
// Output: ./test-data/{circulation,vendors,purchase-orders,serials,gate-visits}.csv

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import fs from "fs";
import path from "path";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../lib/db/schema";
import { eq } from "drizzle-orm";

const conn = postgres(process.env.DATABASE_URL!);
const db = drizzle(conn, { schema });

const OUT_DIR = path.join(process.cwd(), "test-data");

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}
function csvField(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(header: string[], rows: (string | number)[][]): string {
  return [header.join(","), ...rows.map((r) => r.map(csvField).join(","))].join("\n") + "\n";
}
function daysAgo(n: number, hour = randInt(8, 19), minute = randInt(0, 59)): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d;
}
function isoDate(d: Date): string {
  return d.toISOString().split("T")[0];
}
function isoDateTime(d: Date): string {
  return d.toISOString();
}

const VENDOR_NAMES = [
  "Academic Book House", "Prakash Publishers", "National Book Depot", "Sapna Book Distributors",
  "Universal Educational Suppliers", "Higginbothams", "Vidya Book Centre", "Kalpana Publishers",
  "Modern Book Agency", "Reliable Book Suppliers", "Sri Ganesh Book Depot", "Elite Educational Supplies",
];

const SUBJECTS = [
  "Data Structures", "Algorithms", "Operating Systems", "Computer Networks",
  "Database Management Systems", "Machine Learning", "Thermodynamics", "Digital Electronics",
];
const TITLE_SUFFIXES = ["An Introduction", "Principles and Practice", "A Modern Approach", "Fundamentals"];
const PUBLISHERS = ["McGraw Hill", "Pearson", "Wiley", "Springer", "PHI Learning", "Cengage"];

const SERIAL_TITLES = [
  { title: "IEEE Transactions on Computing", issn: "0018-9340", publisher: "IEEE" },
  { title: "ACM Communications", issn: "0001-0782", publisher: "ACM" },
  { title: "Journal of Software Engineering", issn: "1234-5678", publisher: "Elsevier" },
  { title: "International Journal of AI Research", issn: "2222-3333", publisher: "Springer" },
  { title: "Nature Computer Science", issn: "4444-5555", publisher: "Nature" },
  { title: "Electronics Weekly", issn: "6666-7777", publisher: "Reed Business" },
];

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const members = await db.select({ id: schema.members.id, barcode: schema.members.barcode, finePerDay: schema.members.finePerDay })
    .from(schema.members).where(eq(schema.members.isActive, true));
  const copies = await db.select({ id: schema.copies.id, barcode: schema.copies.barcode })
    .from(schema.copies).where(eq(schema.copies.isActive, true));
  const catalogueItems = await db.select({ id: schema.catalogueItems.id, accessionNo: schema.catalogueItems.accessionNo, title: schema.catalogueItems.title })
    .from(schema.catalogueItems).where(eq(schema.catalogueItems.isActive, true));

  if (members.length === 0 || copies.length === 0) {
    console.error("No members/copies found — seed or import books+members first.");
    process.exit(1);
  }

  // ─── Circulation: distinct copies only, so no overlapping loans on the same copy ───
  const shuffledCopies = [...copies].sort(() => Math.random() - 0.5);
  const circCount = Math.min(1200, shuffledCopies.length);
  const circRows: (string | number)[][] = [];
  for (let i = 0; i < circCount; i++) {
    const member = pick(members);
    const copy = shuffledCopies[i];
    const issueDaysAgo = randInt(1, 180);
    const issueDate = daysAgo(issueDaysAgo);
    const loanDays = 14;
    const dueDate = new Date(issueDate); dueDate.setDate(dueDate.getDate() + loanDays);
    const stillOut = issueDaysAgo < 14 && Math.random() < 0.4;
    let returnDate = "";
    if (!stillOut) {
      const returnOffset = randInt(1, Math.min(issueDaysAgo, loanDays + 20));
      const rd = new Date(issueDate); rd.setDate(rd.getDate() + returnOffset);
      if (rd < new Date()) returnDate = isoDateTime(rd);
    }
    circRows.push([member.barcode ?? "", copy.barcode, isoDateTime(issueDate), isoDate(dueDate), returnDate]);
  }
  fs.writeFileSync(path.join(OUT_DIR, "circulation.csv"),
    toCsv(["member_barcode", "copy_barcode", "issue_date", "due_date", "return_date"], circRows));

  // ─── Vendors ───
  const vendorRows = VENDOR_NAMES.map((name, i) => [
    name, `VEN-${String(i + 1).padStart(3, "0")}`, `Contact ${i + 1}`,
    `contact${i + 1}@${name.toLowerCase().replace(/[^a-z]/g, "")}.com`,
    `9${randInt(100000000, 999999999)}`, pick(["Bengaluru", "Chennai", "Mumbai", "Delhi", "Hyderabad"]),
    `29ABCDE${1000 + i}F1Z${i % 10}`,
  ]);
  fs.writeFileSync(path.join(OUT_DIR, "vendors.csv"),
    toCsv(["name", "code", "contact_person", "email", "phone", "city", "gst_no"], vendorRows));

  // ─── Purchase Orders (one item per row) ───
  const poStatuses = ["draft", "sent", "partial", "received"];
  const poRows: (string | number)[][] = [];
  for (let i = 0; i < 70; i++) {
    const vendor = pick(VENDOR_NAMES);
    const orderDaysAgo = randInt(5, 300);
    const orderDate = daysAgo(orderDaysAgo);
    const expected = new Date(orderDate); expected.setDate(expected.getDate() + randInt(10, 30));
    const status = orderDaysAgo > 30 ? pick(["received", "partial"]) : pick(poStatuses);
    const subject = pick(SUBJECTS);
    poRows.push([
      vendor, "BOOKS-GEN", isoDate(orderDate), isoDate(expected), status,
      `${subject}: ${pick(TITLE_SUFFIXES)}`, randInt(5, 50), randInt(300, 2500), randInt(0, 15),
    ]);
  }
  fs.writeFileSync(path.join(OUT_DIR, "purchase-orders.csv"),
    toCsv(["vendor_name", "budget_head_code", "order_date", "expected_delivery", "status", "item_title", "quantity", "unit_price", "discount"], poRows));

  // ─── Serials + issues (monthly, past 12 months) ───
  const serialRows: (string | number)[][] = [];
  const now = new Date();
  for (const s of SERIAL_TITLES) {
    for (let m = 11; m >= 0; m--) {
      const expected = new Date(now); expected.setMonth(expected.getMonth() - m); expected.setDate(5);
      const isPast = expected < now;
      const status = isPast ? (Math.random() < 0.1 ? "missing" : "received") : "expected";
      const received = status === "received" ? isoDate(new Date(expected.getTime() + randInt(0, 5) * 86400000)) : "";
      serialRows.push([s.title, s.issn, s.publisher, "monthly", 12 - m > 0 ? Math.ceil((12 - m) / 12) + 1 : 1, String(12 - m), isoDate(expected), received, status]);
    }
  }
  fs.writeFileSync(path.join(OUT_DIR, "serials.csv"),
    toCsv(["serial_title", "issn", "publisher", "frequency", "volume", "issue_no", "expected_date", "received_date", "status"], serialRows));

  // ─── Gate visits (past 90 days, weekday-biased, business hours) ───
  const gateRows: (string | number)[][] = [];
  for (let d = 90; d >= 1; d--) {
    const date = daysAgo(d, 0, 0);
    if (date.getDay() === 0) continue; // skip Sundays
    const visitsToday = randInt(15, 45);
    for (let v = 0; v < visitsToday; v++) {
      const member = pick(members);
      const entry = daysAgo(d, randInt(8, 18), randInt(0, 59));
      const stayMinutes = randInt(15, 240);
      const exit = new Date(entry.getTime() + stayMinutes * 60000);
      gateRows.push([member.barcode ?? "", isoDateTime(entry), isoDateTime(exit)]);
    }
  }
  // A few open visits today (currently inside) for a live demo state
  for (let i = 0; i < 3; i++) {
    const member = pick(members);
    const entry = daysAgo(0, randInt(9, 13), randInt(0, 59));
    gateRows.push([member.barcode ?? "", isoDateTime(entry), ""]);
  }
  fs.writeFileSync(path.join(OUT_DIR, "gate-visits.csv"),
    toCsv(["member_barcode", "entry_time", "exit_time"], gateRows));

  // ─── Digital Library resources ───
  const RESOURCE_TYPES = ["ebook", "article", "video", "thesis", "report"];
  const digitalRows: (string | number)[][] = [];
  for (let i = 0; i < 60; i++) {
    const subject = pick(SUBJECTS);
    const resourceType = pick(RESOURCE_TYPES);
    digitalRows.push([
      `${subject}: ${pick(TITLE_SUFFIXES)}`, resourceType, `${pick(["Cormen","Stallings","Tanenbaum","Silberschatz","Norvig"])}, ${pick(["R.","A.","S.","P."])}`,
      pick(PUBLISHERS), `https://digitallibrary.amc.edu.in/resources/${i + 1}`, subject, "English",
      randInt(2015, 2025), `A comprehensive ${resourceType} covering ${subject.toLowerCase()} for undergraduate engineering students.`,
      Math.random() < 0.85 ? "true" : "false",
    ]);
  }
  fs.writeFileSync(path.join(OUT_DIR, "digital-library.csv"),
    toCsv(["title", "resource_type", "authors", "source", "external_url", "subjects", "language", "year", "abstract", "is_public"], digitalRows));

  // ─── Reservations (mostly active, some fulfilled/cancelled) ───
  const reservationRows: (string | number)[][] = [];
  const reservationCount = Math.min(80, catalogueItems.length, members.length);
  const shuffledItems = [...catalogueItems].sort(() => Math.random() - 0.5);
  for (let i = 0; i < reservationCount; i++) {
    const member = pick(members);
    const item = shuffledItems[i];
    const reservedDaysAgo = randInt(0, 45);
    const status = reservedDaysAgo < 7 ? "active" : pick(["active", "fulfilled", "cancelled"]);
    reservationRows.push([member.barcode ?? "", item.accessionNo, isoDateTime(daysAgo(reservedDaysAgo)), status]);
  }
  fs.writeFileSync(path.join(OUT_DIR, "reservations.csv"),
    toCsv(["member_barcode", "accession_no", "reserved_at", "status"], reservationRows));

  console.log(`✅ circulation.csv      -> ${circRows.length} rows`);
  console.log(`✅ vendors.csv          -> ${vendorRows.length} rows`);
  console.log(`✅ purchase-orders.csv  -> ${poRows.length} rows`);
  console.log(`✅ serials.csv          -> ${serialRows.length} rows`);
  console.log(`✅ gate-visits.csv      -> ${gateRows.length} rows`);
  console.log(`✅ digital-library.csv  -> ${digitalRows.length} rows`);
  console.log(`✅ reservations.csv     -> ${reservationRows.length} rows`);

  await conn.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
