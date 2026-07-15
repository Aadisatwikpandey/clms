import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { z } from "zod";
import bcrypt from "bcryptjs";

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  isActive: z.boolean().optional(),
  role: z.enum(["admin", "librarian", "staff", "member", "finance", "readonly"]).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const userId = parseInt(id);
  const body = await req.json();
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });

  if (parsed.data.isActive === false && userId === parseInt((session.user as any).id)) {
    return NextResponse.json({ error: "You cannot deactivate your own account" }, { status: 400 });
  }

  if (parsed.data.email) {
    const [existing] = await db.select({ id: users.id }).from(users)
      .where(and(eq(users.email, parsed.data.email), ne(users.id, userId)));
    if (existing) return NextResponse.json({ error: "Another user already has this email" }, { status: 409 });
  }

  const { password, ...rest } = parsed.data;
  const updates: Record<string, unknown> = { ...rest, updatedAt: new Date() };
  if (password) updates.passwordHash = await bcrypt.hash(password, 12);

  const [updated] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, userId))
    .returning({ id: users.id, name: users.name, email: users.email, role: users.role, isActive: users.isActive });

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const userId = parseInt(id);

  if (userId === parseInt((session.user as any).id)) {
    return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
  }

  try {
    const deleted = await db.delete(users).where(eq(users.id, userId)).returning({ id: users.id });
    if (deleted.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    // Postgres FK violation — this user has circulation/audit/purchase history tied to their account.
    // drizzle-orm wraps the raw pg error under `.cause`, so the code lives there, not on the outer error.
    const pgCode = err?.code ?? err?.cause?.code;
    if (pgCode === "23503") {
      return NextResponse.json({
        error: "This user has activity on record (issued books, audit logs, etc.) and can't be permanently deleted. Deactivate the account instead.",
      }, { status: 409 });
    }
    throw err;
  }
}
