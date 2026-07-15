// Generates synthetic books.csv and members.csv for load-testing the Data Migration
// module. Columns match what app/api/migration/route.ts expects.
//
// Usage:
//   npx tsx scripts/generate-test-data.ts --books=5000 --members=2000
//
// Output: ./test-data/books.csv, ./test-data/members.csv

import fs from "fs";
import path from "path";

function arg(name: string, fallback: number): number {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? parseInt(hit.split("=")[1], 10) : fallback;
}

const BOOK_COUNT = arg("books", 2000);
const MEMBER_COUNT = arg("members", 500);
const OUT_DIR = path.join(process.cwd(), "test-data");

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}
function pickN<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length; i++) {
    out.push(copy.splice(randInt(0, copy.length - 1), 1)[0]);
  }
  return out;
}
function csvField(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function isbn13(): string {
  const digits = "978" + Array.from({ length: 9 }, () => randInt(0, 9)).join("");
  const sum = digits
    .split("")
    .reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
  const check = (10 - (sum % 10)) % 10;
  return digits + check;
}

// ─── Data pools ──────────────────────────────────────────────────────────────

const DEPARTMENTS: Record<string, string> = {
  CSE: "B.E. Computer Science and Engineering",
  ISE: "B.E. Information Science and Engineering",
  ECE: "B.E. Electronics and Communication Engineering",
  EEE: "B.E. Electrical and Electronics Engineering",
  ME: "B.E. Mechanical Engineering",
  CV: "B.E. Civil Engineering",
  AIML: "B.E. Artificial Intelligence and Machine Learning",
  AIDS: "B.E. Artificial Intelligence and Data Science",
};
const DEPT_CODES = Object.keys(DEPARTMENTS);
// Distinct 2-letter roll-no codes — AIML/AIDS would otherwise collide since both
// start with "AI" under a naive .slice(0,2).
const ROLL_NO_DEPT_CODE: Record<string, string> = {
  CSE: "CS", ISE: "IS", ECE: "EC", EEE: "EE", ME: "ME", CV: "CV", AIML: "AM", AIDS: "AD",
};

const SUBJECTS = [
  "Data Structures", "Algorithms", "Operating Systems", "Computer Networks",
  "Database Management Systems", "Machine Learning", "Thermodynamics",
  "Fluid Mechanics", "Digital Electronics", "Signals and Systems",
  "Control Systems", "Structural Analysis", "Engineering Mathematics",
  "Power Electronics", "Microprocessors", "Software Engineering",
  "Artificial Intelligence", "Compiler Design", "VLSI Design",
  "Concrete Technology", "Renewable Energy", "Robotics",
];
const TITLE_SUFFIXES = [
  "An Introduction", "Principles and Practice", "Concepts and Applications",
  "A Modern Approach", "Fundamentals", "Theory and Design",
  "Advanced Topics", "A Practical Guide", "Theory and Practice",
];
const PUBLISHERS = [
  "McGraw Hill", "Pearson", "Wiley", "Springer", "MIT Press",
  "Oxford University Press", "PHI Learning", "Cengage", "Elsevier",
  "Tata McGraw Hill", "Cambridge University Press",
];
const FIRST_NAMES = [
  "Ravi", "Anita", "Suresh", "Priya", "Karthik", "Deepa", "Manoj", "Divya",
  "Arjun", "Sneha", "Vikram", "Meena", "Rahul", "Pooja", "Ganesh", "Lakshmi",
  "Thomas", "Robert", "James", "Susan", "Michael", "Linda",
];
const LAST_NAMES = [
  "Kumar", "Sharma", "Rao", "Reddy", "Iyer", "Nair", "Gowda", "Patil",
  "Hegde", "Shetty", "Cormen", "Leiserson", "Stallings", "Tanenbaum",
  "Silberschatz", "Norvig",
];

function personName(): string {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}

// ─── Books ───────────────────────────────────────────────────────────────────

function buildBooksCsv(count: number): string {
  const header = "title,authors,publisher,year,isbn,dewey_no,call_no,language,price,location,copies";
  const rows: string[] = [header];

  for (let i = 0; i < count; i++) {
    const subject = pick(SUBJECTS);
    const title = `${subject}: ${pick(TITLE_SUFFIXES)}`;
    const authors = pickN(
      Array.from({ length: 3 }, personName),
      randInt(1, 2)
    ).join(";");
    const publisher = pick(PUBLISHERS);
    const year = randInt(1998, 2025);
    const isbn = isbn13();
    const deweyNo = `${randInt(0, 999)}.${randInt(0, 99)}`;
    const callNo = `${deweyNo} ${pick(LAST_NAMES).slice(0, 3).toUpperCase()}`;
    const price = randInt(250, 4500);
    const location = `Rack ${randInt(1, 40)}, Shelf ${randInt(1, 8)}`;
    const copies = randInt(1, 5);

    rows.push(
      [title, authors, publisher, year, isbn, deweyNo, callNo, "English", price, location, copies]
        .map(csvField)
        .join(",")
    );
  }
  return rows.join("\n") + "\n";
}

// ─── Members ─────────────────────────────────────────────────────────────────

function buildMembersCsv(count: number): string {
  const header = "name,type,department,course,roll_no,email,phone";
  const rows: string[] = [header];

  const perDept = Math.ceil(count / DEPT_CODES.length);
  let seq = 0;

  for (const deptCode of DEPT_CODES) {
    for (let i = 0; i < perDept && seq < count; i++, seq++) {
      const name = personName();
      const yy = String(randInt(21, 25));
      const rollNo = `1AM${yy}${ROLL_NO_DEPT_CODE[deptCode]}${String(i + 1).padStart(3, "0")}`;
      const type = Math.random() < 0.9 ? "student" : pick(["faculty", "staff", "external"]);
      const email = `${rollNo.toLowerCase()}@amc.edu.in`;
      const phone = `${pick(["6", "7", "8", "9"])}${Array.from({ length: 9 }, () => randInt(0, 9)).join("")}`;

      rows.push(
        [name, type, deptCode, DEPARTMENTS[deptCode], rollNo, email, phone]
          .map(csvField)
          .join(",")
      );
    }
  }
  return rows.join("\n") + "\n";
}

// ─── Main ────────────────────────────────────────────────────────────────────

fs.mkdirSync(OUT_DIR, { recursive: true });

const booksPath = path.join(OUT_DIR, "books.csv");
const membersPath = path.join(OUT_DIR, "members.csv");

fs.writeFileSync(booksPath, buildBooksCsv(BOOK_COUNT));
fs.writeFileSync(membersPath, buildMembersCsv(MEMBER_COUNT));

console.log(`✅ Wrote ${BOOK_COUNT} books   -> ${booksPath}`);
console.log(`✅ Wrote ${MEMBER_COUNT} members -> ${membersPath}`);
