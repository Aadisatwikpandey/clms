import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { sendEmail } from "@/lib/email";
import { z } from "zod";

const schema = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Valid email required" }, { status: 400 });

  const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email));

  // Always return the same response whether or not the account exists, so this
  // endpoint can't be used to enumerate registered staff emails.
  if (user && user.isActive) {
    const token = randomBytes(32).toString("hex");
    await db
      .update(users)
      .set({ passwordResetToken: token, passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000) })
      .where(eq(users.id, user.id));

    const origin = req.nextUrl.origin;
    const resetUrl = `${origin}/reset-password?token=${token}`;
    const html = `
      <h2>Password Reset – AMC Library</h2>
      <p>Someone requested a password reset for this account. If this was you, click below — this link expires in 1 hour.</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>If you didn't request this, you can ignore this email.</p>
    `;
    await sendEmail(user.email, "Password Reset – AMC Library", html).catch(() => {});
  }

  return NextResponse.json({ message: "If that email is registered, a reset link has been sent." });
}
