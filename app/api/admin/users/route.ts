import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { z } from "zod";
import bcrypt from "bcryptjs";

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["admin","librarian","staff","member","finance","readonly"]).default("librarian"),
  memberId: z.number().int().optional(),
});

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const allUsers = await db.select({ id: users.id, name: users.name, email: users.email, role: users.role, isActive: users.isActive, lastLogin: users.lastLogin }).from(users);
  return NextResponse.json(allUsers);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, parsed.data.email)).limit(1);
  if (existing.length > 0) {
    return NextResponse.json({ error: "A user with this email already exists." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const [user] = await db.insert(users).values({
    ...parsed.data,
    passwordHash,
  }).returning({ id: users.id, name: users.name, email: users.email, role: users.role });

  return NextResponse.json(user, { status: 201 });
}
