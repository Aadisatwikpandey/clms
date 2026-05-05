import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../lib/db/schema";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

const conn = postgres(process.env.DATABASE_URL!);
const db = drizzle(conn, { schema });

async function seed() {
  console.log("🌱 Seeding database...");

  // Create admin user
  const existing = await db.select().from(schema.users).where(eq(schema.users.email, "admin@amcengineering.edu.in"));
  if (existing.length === 0) {
    const passwordHash = await bcrypt.hash("Admin@123", 12);
    await db.insert(schema.users).values({
      name: "Library Administrator",
      email: "admin@amcengineering.edu.in",
      passwordHash,
      role: "admin",
    });
    console.log("✅ Admin user created: admin@amcengineering.edu.in / Admin@123");
  } else {
    console.log("ℹ️  Admin user already exists");
  }

  // Default system config
  const configs = [
    { key: "college_name", value: "AMC Engineering College" },
    { key: "library_name", value: "AMC College Library" },
    { key: "library_address", value: "Bannerghatta Road, Bengaluru, Karnataka 560083" },
    { key: "currency", value: "INR" },
    { key: "timezone", value: "Asia/Kolkata" },
    { key: "fine_per_day", value: "1.00" },
    { key: "max_books_student", value: "3" },
    { key: "max_days_student", value: "14" },
    { key: "max_renewals", value: "2" },
    { key: "reservation_expiry_days", value: "7" },
  ];
  for (const cfg of configs) {
    await db.insert(schema.systemConfig).values(cfg).onConflictDoNothing();
  }
  console.log("✅ System config seeded");

  // Default budget heads
  const fy = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
  const heads = [
    { name: "Book Procurement – General", code: "BOOKS-GEN", type: "expense", financialYear: fy, allocatedAmount: "200000" },
    { name: "Journal Subscriptions", code: "JOURNALS", type: "expense", financialYear: fy, allocatedAmount: "100000" },
    { name: "Digital Library", code: "DIGITAL", type: "expense", financialYear: fy, allocatedAmount: "50000" },
    { name: "Fine Collection", code: "FINES-IN", type: "income", financialYear: fy, allocatedAmount: "0" },
  ];
  for (const h of heads) {
    await db.insert(schema.budgetHeads).values(h).onConflictDoNothing();
  }
  console.log("✅ Budget heads seeded");

  await conn.end();
  console.log("✅ Seeding complete.");
}

seed().catch((err) => { console.error(err); process.exit(1); });
