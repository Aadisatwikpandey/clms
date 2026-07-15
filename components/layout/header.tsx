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
    <header className="h-16 bg-white/80 backdrop-blur-sm border-b border-[var(--sidebar-border)] px-6 flex items-center justify-between shrink-0">
      <h1 className="text-lg font-semibold text-[var(--foreground)]">{title}</h1>
      <div className="flex items-center gap-3">
        <Badge className="capitalize rounded-full bg-[var(--secondary)] text-[var(--secondary-foreground)] border-transparent">{role}</Badge>
        <Avatar className="h-9 w-9 ring-2 ring-[var(--accent)]">
          <AvatarFallback className="bg-gradient-to-br from-[#6D5DFB] to-[#8B7CFC] text-white text-xs font-bold">
            {user?.name?.charAt(0)?.toUpperCase() ?? "U"}
          </AvatarFallback>
        </Avatar>
        <span className="text-sm font-medium text-[var(--foreground)] hidden sm:inline">{user?.name}</span>
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => signOut({ callbackUrl: "/login" })}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
