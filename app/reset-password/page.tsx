"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookMarked, Loader2 } from "lucide-react";
import { toast } from "sonner";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    setLoading(true);
    try {
      await axios.post("/api/auth/reset-password", { token, password });
      toast.success("Password reset — sign in with your new password");
      router.push("/login");
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Reset failed");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return <p className="text-sm text-center text-slate-600">This reset link is missing its token — request a new one from the forgot password page.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">New Password</Label>
        <PasswordInput id="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Confirm Password</Label>
        <PasswordInput id="confirm" placeholder="••••••••" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={8} required />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Reset Password
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#3B2F8F] to-[#6D5DFB] p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <div className="bg-[#EEEBFF] rounded-full p-3">
              <BookMarked className="h-8 w-8 text-violet-600" />
            </div>
          </div>
          <CardTitle className="text-2xl">Set New Password</CardTitle>
          <CardDescription>Choose a new password for your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Loader2 className="h-5 w-5 animate-spin mx-auto" />}>
            <ResetPasswordForm />
          </Suspense>
          <p className="text-center text-xs text-slate-500 mt-4">
            <Link href="/login" className="text-violet-600 hover:underline">Back to Sign In</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
