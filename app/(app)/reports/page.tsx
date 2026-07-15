"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";

const COLORS = ["#6D5DFB","#14B8A6","#f59e0b","#ef4444","#EC4899"];

export default function ReportsPage() {
  const [reportType, setReportType] = useState("circulation");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["report", reportType, from, to],
    queryFn: () => axios.get(`/api/reports?type=${reportType}&from=${from}&to=${to}`).then((r) => r.data),
  });

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header title="Reports & Statistics" />
      <div className="p-6 space-y-4">
        <div className="flex gap-3 flex-wrap">
          <Select value={reportType} onValueChange={(v) => { if (v !== null) setReportType(v); }}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="circulation">Circulation Statistics</SelectItem>
              <SelectItem value="fines">Fine Collection</SelectItem>
              <SelectItem value="acquisitions">Acquisitions</SelectItem>
              <SelectItem value="top-books">Top Borrowed Books</SelectItem>
              <SelectItem value="top-members">Top Readers</SelectItem>
              <SelectItem value="missing-serials">Serial Status</SelectItem>
              <SelectItem value="gate">Library Gate / Footfall</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" placeholder="From" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" placeholder="To" />
          <Button variant="outline" onClick={() => refetch()}>Refresh</Button>
        </div>

        {isFetching ? <p className="text-slate-500">Loading...</p> : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {reportType === "circulation" && data && (
              <>
                <Card>
                  <CardHeader><CardTitle className="text-sm">Daily Issue Trend</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={data.daily ?? []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="count" stroke="#6D5DFB" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-sm">Transactions by Type</CardTitle></CardHeader>
                  <CardContent className="flex justify-center">
                    <PieChart width={250} height={250}>
                      <Pie data={(data.byType ?? []).map((d: any) => ({ ...d, count: Number(d.count) }))} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={90} label>
                        {(data.byType ?? []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </CardContent>
                </Card>
              </>
            )}
            {reportType === "fines" && data && (
              <>
                <Card><CardContent className="pt-6">
                  <div className="space-y-3">
                    <div className="flex justify-between"><span>Pending Fines</span><span className="font-bold text-red-600">₹{Number(data.pending).toFixed(2)}</span></div>
                    <div className="flex justify-between"><span>Collected Fines</span><span className="font-bold text-green-600">₹{Number(data.collected).toFixed(2)}</span></div>
                  </div>
                </CardContent></Card>
                <Card>
                  <CardHeader><CardTitle className="text-sm">Monthly Fine Collection</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={data.monthly ?? []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="amount" fill="#14B8A6" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </>
            )}
            {(reportType === "top-books" || reportType === "top-members") && data && (
              <Card className="col-span-2">
                <CardHeader><CardTitle className="text-sm">{reportType === "top-books" ? "Top Borrowed Books" : "Top Readers"}</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis dataKey={reportType === "top-books" ? "title" : "name"} type="category" width={140} tick={{ fontSize: 9 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#EC4899" radius={[0,4,4,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
            {reportType === "missing-serials" && data && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Serial Issue Status</CardTitle></CardHeader>
                <CardContent className="flex justify-center">
                  <PieChart width={250} height={250}>
                    <Pie data={(data ?? []).map((d: any) => ({ ...d, count: Number(d.count) }))} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={90} label>
                      {(data ?? []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </CardContent>
              </Card>
            )}
            {reportType === "gate" && data && (
              <>
                <Card className="col-span-2 xl:col-span-1">
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      <div className="flex justify-between"><span>Average Time in Library</span><span className="font-bold text-violet-600">{Math.round(data.avgDuration)} min</span></div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-sm">Daily Footfall</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={data.daily ?? []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="count" stroke="#6D5DFB" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-sm">Visits by Hour of Day</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={data.byHour ?? []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#f59e0b" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-sm">Footfall by Department</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={data.byDept ?? []} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tick={{ fontSize: 10 }} />
                        <YAxis dataKey="department" type="category" width={80} tick={{ fontSize: 9 }} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#EC4899" radius={[0,4,4,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </>
            )}
            {reportType === "acquisitions" && data && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Orders by Status</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.byStatus ?? []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="status" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#f59e0b" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
