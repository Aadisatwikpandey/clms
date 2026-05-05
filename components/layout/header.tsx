"use client";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LogOut, Bell } from "lucide-react";

export function Header({ title }: { title: string }) {
  const { data: session } = useSession();
  const user = session?.user;
  const role = (user as any)?.role ?? "";

  return (
    <header className="h-14 border-b bg-white px-6 flex items-center justify-between shrink-0">
      <h1 className="text-lg font-semibold text-slate-800">{title}</h1>
      <div className="flex items-center gap-3">
        <Badge variant="outline" className="capitalize">{role}</Badge>
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-blue-100 text-blue-700 text-xs font-bold">
            {user?.name?.charAt(0)?.toUpperCase() ?? "U"}
          </AvatarFallback>
        </Avatar>
        <span className="text-sm text-slate-600 hidden sm:inline">{user?.name}</span>
        <Button variant="ghost" size="icon" onClick={() => signOut({ callbackUrl: "/login" })}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
