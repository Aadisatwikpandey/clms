// Logs in as admin against the running app and posts the generated CSVs to
// /api/migration, exactly like the Admin > Data Migration UI would — so this
// exercises the real HTTP + auth + DB path and reports how the system reacts
// (latency, throughput, failures).
//
// Prereqs: `npx tsx scripts/generate-test-data.ts` has been run, and the app
// is up (docker compose, or `npm run dev`).
//
// Usage:
//   BASE_URL=http://localhost:3000 npx tsx scripts/load-test-import.ts

import fs from "fs";
import path from "path";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@amcengineering.edu.in";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "Admin@123";

// Minimal cookie jar — good enough for a single-session script.
const jar = new Map<string, string>();

function storeCookies(res: Response) {
  const setCookies =
    typeof (res.headers as any).getSetCookie === "function"
      ? (res.headers as any).getSetCookie()
      : [res.headers.get("set-cookie")].filter(Boolean) as string[];
  for (const raw of setCookies) {
    const [pair] = raw.split(";");
    const idx = pair.indexOf("=");
    jar.set(pair.slice(0, idx), pair.slice(idx + 1));
  }
}
function cookieHeader(): string {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function login() {
  console.log(`🔐 Logging in as ${ADMIN_EMAIL} ...`);

  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
  storeCookies(csrfRes);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

  const loginRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      Cookie: cookieHeader(),
    },
    body: new URLSearchParams({
      csrfToken,
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      callbackUrl: `${BASE_URL}/dashboard`,
      json: "true",
    }),
  });
  storeCookies(loginRes);

  const sessionRes = await fetch(`${BASE_URL}/api/auth/session`, {
    headers: { Cookie: cookieHeader() },
  });
  storeCookies(sessionRes);
  const session = await sessionRes.json();

  if (!session?.user) {
    throw new Error(
      `Login failed — no session established. Check ADMIN_EMAIL/ADMIN_PASSWORD and that db:seed has run. Status was ${loginRes.status}.`
    );
  }
  console.log(`✅ Logged in as ${session.user.email} (role: ${session.user.role})`);
}

async function importFile(filePath: string, type: "books" | "members") {
  const buf = fs.readFileSync(filePath);
  const rowCount = buf.toString("utf8").split("\n").filter(Boolean).length - 1;

  const form = new FormData();
  form.append("file", new Blob([buf], { type: "text/csv" }), path.basename(filePath));
  form.append("type", type);

  console.log(`\n📤 Importing ${rowCount} ${type} rows from ${filePath} ...`);
  const start = Date.now();

  const res = await fetch(`${BASE_URL}/api/migration`, {
    method: "POST",
    headers: { Cookie: cookieHeader() },
    body: form,
  });

  const elapsedMs = Date.now() - start;
  const body = await res.json().catch(() => ({}));

  console.log(`   HTTP ${res.status} in ${elapsedMs}ms (${(rowCount / (elapsedMs / 1000)).toFixed(1)} rows/sec)`);
  console.log(`   imported=${body.imported} failed=${body.failed} total=${body.total}`);
  if (body.failures?.length) {
    console.log(`   Sample failures:`, JSON.stringify(body.failures.slice(0, 3), null, 2));
  }
}

async function main() {
  await login();

  const booksPath = path.join(process.cwd(), "test-data", "books.csv");
  const membersPath = path.join(process.cwd(), "test-data", "members.csv");

  if (fs.existsSync(booksPath)) await importFile(booksPath, "books");
  else console.log(`⚠️  Skipping books — ${booksPath} not found. Run generate-test-data.ts first.`);

  if (fs.existsSync(membersPath)) await importFile(membersPath, "members");
  else console.log(`⚠️  Skipping members — ${membersPath} not found. Run generate-test-data.ts first.`);
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
