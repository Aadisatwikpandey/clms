"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  BookOpen, Users, ArrowLeftRight, ShoppingCart, Layers,
  Monitor, HardDrive, BarChart2, DollarSign, Package,
  Bell, Settings, Upload, Search, BookMarked,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart2, roles: ["admin","librarian","staff","finance","readonly","member"] },
  { href: "/cataloguing", label: "Catalogue", icon: BookOpen, roles: ["admin","librarian","staff"] },
  { href: "/circulation", label: "Circulation", icon: ArrowLeftRight, roles: ["admin","librarian","staff"] },
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
    <aside className="flex flex-col w-64 min-h-screen bg-slate-900 text-white shrink-0">
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <BookMarked className="h-6 w-6 text-blue-400" />
          <div>
            <p className="font-bold text-sm leading-tight">AMC Library</p>
            <p className="text-xs text-slate-400 leading-tight">Management System</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {visible.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              pathname.startsWith(href) && href !== "/dashboard"
                ? "bg-blue-600 text-white"
                : pathname === href && href === "/dashboard"
                ? "bg-blue-600 text-white"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-700 text-xs text-slate-500">
        CLMS v1.0 · AMC Engineering College
      </div>
    </aside>
  );
}
