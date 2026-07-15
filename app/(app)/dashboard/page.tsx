"use client";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useSession } from "next-auth/react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Users, ArrowLeftRight, AlertCircle, DollarSign, Package, DoorOpen } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

const COLORS = ["#6D5DFB", "#14B8A6", "#F59E0B", "#EF4444", "#3B82F6", "#EC4899"];

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const name = session?.user?.name?.split(" ")[0] ?? "there";

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => axios.get("/api/reports?type=dashboard").then((r) => r.data),
  });

  const { data: circ } = useQuery({
    queryKey: ["circ-stats"],
    queryFn: () => axios.get("/api/reports?type=circulation").then((r) => r.data),
  });

  const { data: topBooks } = useQuery({
    queryKey: ["top-books"],
    queryFn: () => axios.get("/api/reports?type=top-books").then((r) => r.data),
  });

  const statCards = [
    { title: "Total Books", value: stats?.totalBooks ?? 0, icon: BookOpen, bg: "#EEEBFF", fg: "#6D5DFB" },
    { title: "Members", value: stats?.totalMembers ?? 0, icon: Users, bg: "#E3EEFF", fg: "#3B82F6" },
    { title: "Active Loans", value: stats?.activeLoans ?? 0, icon: ArrowLeftRight, bg: "#FEF3D7", fg: "#F59E0B" },
    { title: "Overdue Items", value: stats?.overdueLoans ?? 0, icon: AlertCircle, bg: "#FDE8E8", fg: "#EF4444" },
    { title: "Fines Pending (₹)", value: Number(stats?.totalFinesPending ?? 0).toFixed(2), icon: DollarSign, bg: "#FDE7F3", fg: "#EC4899" },
    { title: "New Arrivals (30d)", value: stats?.newArrivals ?? 0, icon: Package, bg: "#E0F8E6", fg: "#22C55E" },
    { title: "Currently Inside", value: stats?.currentlyInside ?? 0, icon: DoorOpen, bg: "#DFF7F0", fg: "#14B8A6" },
  ];

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header title="Dashboard" />
      <div className="p-6 space-y-6">
        {/* Hero banner */}
        <div className="rounded-3xl bg-gradient-to-br from-[#6D5DFB] to-[#5B9DF9] p-8 text-white overflow-hidden relative">
          <p className="text-sm text-white/80">{new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
          <h2 className="text-2xl font-bold mt-1">{greeting()}, {name} 👋</h2>
          <p className="text-sm text-white/80 mt-1">Here's what's happening at the library today.</p>
          <div className="flex flex-wrap gap-3 mt-5">
            <div className="bg-white/15 rounded-2xl px-5 py-3">
              <p className="text-xl font-bold">{stats?.currentlyInside ?? "—"}</p>
              <p className="text-xs text-white/80">Members Inside</p>
            </div>
            <div className="bg-white/15 rounded-2xl px-5 py-3">
              <p className="text-xl font-bold">{stats?.overdueLoans ?? "—"}</p>
              <p className="text-xs text-white/80">Books Overdue</p>
            </div>
            <div className="bg-white/15 rounded-2xl px-5 py-3">
              <p className="text-xl font-bold">{stats?.activeLoans ?? "—"}</p>
              <p className="text-xs text-white/80">Active Loans</p>
            </div>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-4">
          {statCards.map(({ title, value, icon: Icon, bg, fg }) => (
            <Card key={title} className="rounded-2xl">
              <CardContent className="pt-4 pb-4">
                <div
                  className="h-9 w-9 rounded-full flex items-center justify-center mb-3"
                  style={{ backgroundColor: bg }}
                >
                  <Icon className="h-4 w-4" style={{ color: fg }} />
                </div>
                {isLoading ? (
                  <Skeleton className="h-7 w-16" />
                ) : (
                  <p className="text-2xl font-bold text-[var(--foreground)]">{value}</p>
                )}
                <span className="text-xs text-[var(--muted-foreground)]">{title}</span>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Circulation trend */}
          <Card className="rounded-2xl">
            <CardHeader><CardTitle className="text-sm">Daily Issues (last 30 days)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={circ?.daily ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                  <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)" }} />
                  <Line type="monotone" dataKey="count" stroke="#6D5DFB" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top books bar chart */}
          <Card className="rounded-2xl">
            <CardHeader><CardTitle className="text-sm">Top 10 Most Borrowed Books</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topBooks ?? []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                  <YAxis dataKey="title" type="category" width={120} tick={{ fontSize: 9 }} stroke="var(--muted-foreground)" />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)" }} />
                  <Bar dataKey="count" fill="#6D5DFB" radius={[0,8,8,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Transaction type donut */}
          <Card className="rounded-2xl">
            <CardHeader><CardTitle className="text-sm">Transactions by Type</CardTitle></CardHeader>
            <CardContent className="flex justify-center">
              <PieChart width={220} height={220}>
                <Pie data={(circ?.byType ?? []).map((d: any) => ({ ...d, count: Number(d.count) }))} dataKey="count" nameKey="type" cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={2}>
                  {(circ?.byType ?? []).map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)" }} />
                <Legend />
              </PieChart>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
