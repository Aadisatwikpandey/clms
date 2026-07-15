"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  BookOpen, Users, ArrowLeftRight, ShoppingCart, Layers,
  Monitor, HardDrive, BarChart2, DollarSign, Package,
  Bell, Settings, Upload, Search, BookMarked, DoorOpen,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart2, roles: ["admin","librarian","staff","finance","readonly","member"] },
  { href: "/cataloguing", label: "Catalogue", icon: BookOpen, roles: ["admin","librarian","staff"] },
  { href: "/circulation", label: "Circulation", icon: ArrowLeftRight, roles: ["admin","librarian","staff"] },
  { href: "/gate", label: "Library Gate", icon: DoorOpen, roles: ["admin","librarian","staff","finance","readonly"] },
  { href: "/members", label: "Members", icon: Users, roles: ["admin","librarian","staff"] },
  { href: "/opac", label: "OPAC Search", icon: Search, roles: ["admin","librarian","staff","member","readonly"] },
  { href: "/acquisitions", label: "Acquisitions", icon: ShoppingCart, roles: ["admin","librarian","finance"] },
  { href: "/serials", label: "Serials", icon: Layers, roles: ["admin","librarian","staff"] },
  { href: "/digital-library", label: "Digital Library", icon: Monitor, roles: ["admin","librarian","staff","member"] },
  { href: "/reports", label: "Reports", icon: BarChart2, roles: ["admin","librarian","finance","readonly"] },
  { href: "/finance", label: "Finance", icon: DollarSign, roles: ["admin","finance"] },
  { href: "/stock", label: "Stock Verification", icon: Package, roles: ["admin","librarian"] },
  { href: "/migration", label: "Data Migration", icon: Upload, roles: ["admin"] },
  { href: "/admin", label: "Admin", icon: Settings, roles: ["admin"] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = (session?.user as any)?.role ?? "readonly";

  const visible = navItems.filter((item) => item.roles.includes(role));

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-white border-r border-[var(--sidebar-border)] shrink-0">
      <div className="p-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#6D5DFB] to-[#8B7CFC] flex items-center justify-center shrink-0">
            <BookMarked className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-sm leading-tight text-[var(--foreground)]">AMC Library</p>
            <p className="text-xs text-[var(--muted-foreground)] leading-tight">Management System</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {visible.map(({ href, label, icon: Icon }) => {
          const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-medium transition-colors",
                active
                  ? "bg-[var(--primary)] text-white shadow-sm shadow-[#6D5DFB]/30"
                  : "text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 mt-2 mx-3 mb-4 rounded-2xl bg-[var(--sidebar-accent)] text-xs text-[var(--muted-foreground)] text-center">
        CLMS v1.0 · AMC Engineering College
      </div>
    </aside>
  );
}
