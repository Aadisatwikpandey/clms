"use client";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import axios from "axios";
import { format, formatDistanceToNowStrict } from "date-fns";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RowListSkeleton } from "@/components/ui/loading-cards";
import { Pagination } from "@/components/ui/pagination";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { LogIn, LogOut, Users, Download, Undo2 } from "lucide-react";

function ScanPanel() {
  const [barcode, setBarcode] = useState("");
  const [recent, setRecent] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  useEffect(() => { inputRef.current?.focus(); }, []);

  const scanMutation = useMutation({
    mutationFn: (data: { barcode: string }) => axios.post("/api/gate/scan", data).then((r) => r.data),
    onSuccess: (data) => {
      setRecent((prev) => [{ ...data, at: new Date() }, ...prev].slice(0, 15));
      toast.success(
        data.action === "entry"
          ? `${data.member.name} checked in`
          : `${data.member.name} checked out — ${data.visit.durationMinutes} min in library`
      );
      setBarcode("");
      inputRef.current?.focus();
      qc.invalidateQueries({ queryKey: ["gate-current"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error ?? "Scan failed");
      setBarcode("");
      inputRef.current?.focus();
    },
  });

  const undoMutation = useMutation({
    mutationFn: (visitId: number) => axios.post("/api/gate/scan/undo", { visitId }).then((r) => r.data),
    onSuccess: (_data, visitId) => {
      setRecent((prev) => prev.map((r) => (r.visit.id === visitId ? { ...r, undone: true } : r)));
      toast.success("Scan undone");
      qc.invalidateQueries({ queryKey: ["gate-current"] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? "Undo failed"),
  });

  function handleScan(e: React.KeyboardEvent) {
    if (e.key === "Enter" && barcode.trim() && !scanMutation.isPending) {
      scanMutation.mutate({ barcode: barcode.trim() });
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium">Scan Student ID Card (USN Barcode)</label>
        <Input
          ref={inputRef}
          autoFocus
          placeholder="Scan barcode — auto-submits on Enter"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          onKeyDown={handleScan}
          onBlur={() => setTimeout(() => inputRef.current?.focus(), 100)}
          className="text-lg h-12"
        />
        <p className="text-xs text-slate-500">Keep this field focused — the scanner types the USN and presses Enter automatically.</p>
      </div>

      <div className="space-y-2 max-h-[28rem] overflow-y-auto">
        {recent.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">No scans yet in this session</p>
        )}
        {recent.map((r, i) => (
          <Alert
            key={i}
            className={r.undone ? "border-slate-200 bg-slate-50 opacity-60" : r.action === "entry" ? "border-green-200 bg-green-50" : "border-violet-200 bg-violet-50"}
          >
            {r.action === "entry" ? <LogIn className="h-4 w-4 text-green-600" /> : <LogOut className="h-4 w-4 text-violet-600" />}
            <AlertDescription className="text-sm flex items-center justify-between w-full gap-2">
              <span>
                <strong>{r.member.name}</strong> ({r.member.rollNo ?? r.member.membershipNo}) — {r.action === "entry" ? "Entry" : "Exit"}
                {r.action === "exit" && ` · ${r.visit.durationMinutes} min`}
                {r.undone && <span className="text-slate-400"> · undone</span>}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-slate-500">{format(new Date(r.at), "HH:mm:ss")}</span>
                {!r.undone && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2"
                    disabled={undoMutation.isPending}
                    onClick={() => undoMutation.mutate(r.visit.id)}
                  >
                    <Undo2 className="h-3 w-3 mr-1" /> Undo
                  </Button>
                )}
              </div>
            </AlertDescription>
          </Alert>
        ))}
      </div>
    </div>
  );
}

function CurrentlyInsidePanel() {
  const qc = useQueryClient();
  const { data: session } = useSession();
  const role = (session?.user as any)?.role ?? "readonly";
  const canMarkLeft = ["admin", "librarian", "staff"].includes(role);

  const { data, isLoading } = useQuery({
    queryKey: ["gate-current"],
    queryFn: () => axios.get("/api/gate/current").then((r) => r.data),
    refetchInterval: 15000,
  });

  const markLeftMutation = useMutation({
    mutationFn: (barcode: string) => axios.post("/api/gate/scan", { barcode }).then((r) => r.data),
    onSuccess: (result) => {
      toast.success(`${result.member.name} marked as left`);
      qc.invalidateQueries({ queryKey: ["gate-current"] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? "Failed"),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-violet-600" />
        <span className="text-lg font-bold">{data?.count ?? 0}</span>
        <span className="text-sm text-slate-500">member(s) currently inside</span>
      </div>
      {isLoading ? <RowListSkeleton count={4} /> : (
        <div className="space-y-2 max-h-[28rem] overflow-y-auto">
          {(data?.visitors ?? []).length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">Nobody is currently inside</p>
          )}
          {(data?.visitors ?? []).map((v: any) => (
            <div key={v.visitId} className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
              <div>
                <p className="font-medium text-sm">{v.name} <span className="text-slate-400 font-normal">· {v.rollNo}</span></p>
                <p className="text-xs text-slate-500">{v.department} · {v.memberType}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <Badge variant="secondary">{formatDistanceToNowStrict(new Date(v.entryTime))}</Badge>
                  <p className="text-xs mt-1 text-slate-500">since {format(new Date(v.entryTime), "HH:mm")}</p>
                </div>
                {canMarkLeft && (
                  <ConfirmDialog
                    trigger={<Button size="sm" variant="outline">Mark as Left</Button>}
                    title={`Mark ${v.name} as left?`}
                    description="Use this only if the member forgot to scan out or the scanner missed them. This closes their visit right now, as if they had scanned out themselves."
                    confirmLabel="Mark as Left"
                    destructive={false}
                    onConfirm={() => markLeftMutation.mutate(v.barcode ?? v.rollNo)}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryPanel() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [department, setDepartment] = useState("");
  const [page, setPage] = useState(1);
  const limit = 50;

  const { data, isFetching } = useQuery({
    queryKey: ["gate-visits", from, to, department, page],
    queryFn: () =>
      axios
        .get("/api/gate/visits", { params: { from, to, department, page, limit } })
        .then((r) => r.data),
  });

  function exportCsv() {
    const rows = data?.visits ?? [];
    const header = "Name,Roll No,Department,Type,Entry Time,Exit Time,Duration (min),Auto-closed";
    const lines = rows.map((v: any) =>
      [
        v.name, v.rollNo ?? "", v.department ?? "", v.memberType,
        format(new Date(v.entryTime), "yyyy-MM-dd HH:mm"),
        v.exitTime ? format(new Date(v.exitTime), "yyyy-MM-dd HH:mm") : "Still inside",
        v.durationMinutes ?? "", v.autoClosed ? "Yes" : "No",
      ].map((f) => `"${String(f).replace(/"/g, '""')}"`).join(",")
    );
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `library-visits-${format(new Date(), "yyyyMMdd-HHmm")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap items-end">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">From</label>
          <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="w-40" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">To</label>
          <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="w-40" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Department</label>
          <Input placeholder="e.g. CSE" value={department} onChange={(e) => { setDepartment(e.target.value); setPage(1); }} className="w-32" />
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={!data?.visits?.length}>
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
      </div>

      {isFetching ? <RowListSkeleton count={4} /> : (
        <div className="space-y-2 max-h-[24rem] overflow-y-auto">
          {(data?.visits ?? []).length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">No visits found for this filter</p>
          )}
          {(data?.visits ?? []).map((v: any) => (
            <div key={v.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium text-sm">{v.name} <span className="text-slate-400 font-normal">· {v.rollNo}</span></p>
                <p className="text-xs text-slate-500">
                  {v.department} · {format(new Date(v.entryTime), "dd MMM yyyy, HH:mm")}
                  {v.exitTime ? ` → ${format(new Date(v.exitTime), "HH:mm")}` : ""}
                </p>
              </div>
              <div className="text-right">
                {v.exitTime ? (
                  <Badge variant="secondary">{v.durationMinutes} min</Badge>
                ) : (
                  <Badge className="bg-green-100 text-green-800">Inside</Badge>
                )}
                {v.autoClosed && <p className="text-xs mt-1 text-amber-600">Auto-closed</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Pagination page={data?.page ?? page} onPageChange={setPage} hasNext={(data?.visits?.length ?? 0) >= limit} total={data?.total} />
    </div>
  );
}

export default function GatePage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role ?? "readonly";
  const canScan = ["admin", "librarian", "staff"].includes(role);

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header title="Library Gate" />
      <div className="p-6">
        <Tabs defaultValue={canScan ? "scan" : "current"}>
          <TabsList className="mb-4">
            {canScan && <TabsTrigger value="scan">Scan</TabsTrigger>}
            <TabsTrigger value="current">Currently Inside</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
          <Card>
            <CardContent className="pt-6">
              {canScan && <TabsContent value="scan"><ScanPanel /></TabsContent>}
              <TabsContent value="current"><CurrentlyInsidePanel /></TabsContent>
              <TabsContent value="history"><HistoryPanel /></TabsContent>
            </CardContent>
          </Card>
        </Tabs>
      </div>
    </div>
  );
}
