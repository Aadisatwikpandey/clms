"use client";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Users, ArrowLeftRight, AlertCircle, DollarSign, Package } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

const COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4"];

export default function DashboardPage() {
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
    { title: "Total Books", value: stats?.totalBooks ?? 0, icon: BookOpen, color: "text-blue-600" },
    { title: "Members", value: stats?.totalMembers ?? 0, icon: Users, color: "text-green-600" },
    { title: "Active Loans", value: stats?.activeLoans ?? 0, icon: ArrowLeftRight, color: "text-violet-600" },
    { title: "Overdue Items", value: stats?.overdueLoans ?? 0, icon: AlertCircle, color: "text-red-600" },
    { title: "Fines Pending (₹)", value: Number(stats?.totalFinesPending ?? 0).toFixed(2), icon: DollarSign, color: "text-amber-600" },
    { title: "New Arrivals (30d)", value: stats?.newArrivals ?? 0, icon: Package, color: "text-cyan-600" },
  ];

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header title="Dashboard" />
      <div className="p-6 space-y-6">
        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {statCards.map(({ title, value, icon: Icon, color }) => (
            <Card key={title}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`h-4 w-4 ${color}`} />
                  <span className="text-xs text-slate-500">{title}</span>
                </div>
                {isLoading ? (
                  <Skeleton className="h-7 w-16" />
                ) : (
                  <p className="text-2xl font-bold text-slate-800">{value}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Circulation trend */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Daily Issues (last 30 days)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={circ?.daily ?? []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top books bar chart */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Top 10 Most Borrowed Books</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topBooks ?? []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="title" type="category" width={120} tick={{ fontSize: 9 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Transaction type pie */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Transactions by Type</CardTitle></CardHeader>
            <CardContent className="flex justify-center">
              <PieChart width={220} height={220}>
                <Pie data={circ?.byType ?? []} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={80} label>
                  {(circ?.byType ?? []).map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
