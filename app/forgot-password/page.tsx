"use client";
import { useState } from "react";
import Link from "next/link";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookMarked, Loader2, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post("/api/auth/forgot-password", { email });
    } finally {
      setLoading(false);
      setSent(true);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#3B2F8F] to-[#6D5DFB] p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <div className="bg-[#EEEBFF] rounded-full p-3">
              <BookMarked className="h-8 w-8 text-violet-600" />
            </div>
          </div>
          <CardTitle className="text-2xl">Reset Password</CardTitle>
          <CardDescription>Enter your account email and we'll send you a reset link.</CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <p className="text-sm text-center text-slate-600">
              If that email is registered, a reset link has been sent. Check your inbox — the link expires in 1 hour.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@amcengineering.edu.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Send Reset Link
              </Button>
            </form>
          )}
          <p className="text-center text-xs text-slate-500 mt-4">
            <Link href="/login" className="inline-flex items-center gap-1 text-violet-600 hover:underline">
              <ArrowLeft className="h-3 w-3" /> Back to Sign In
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
