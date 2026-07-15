"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RowListSkeleton } from "@/components/ui/loading-cards";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { X, ArrowLeft } from "lucide-react";

function MissingCopiesPanel({ sessionId, onBack }: { sessionId: number; onBack: () => void }) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<number[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["stock-session-detail", sessionId],
    queryFn: () => axios.get(`/api/stock-verification/${sessionId}`).then((r) => r.data),
  });

  const withdrawMutation = useMutation({
    mutationFn: (copyIds: number[]) =>
      axios.post("/api/stock-verification", { action: "withdraw", copyIds, reason: `Missing from stock session #${sessionId}` }).then((r) => r.data),
    onSuccess: (res) => {
      toast.success(`Withdrew ${res.withdrawn} copy/copies`);
      setSelected([]);
      qc.invalidateQueries({ queryKey: ["stock-session-detail", sessionId] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? "Withdraw failed"),
  });

  const missing = data?.missing ?? [];

  function toggle(copyId: number) {
    setSelected((prev) => (prev.includes(copyId) ? prev.filter((id) => id !== copyId) : [...prev, copyId]));
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Back to Sessions
      </button>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">{data?.session?.sessionName}</h2>
          <p className="text-sm text-slate-500">{missing.length} copy/copies not verified in this session</p>
        </div>
        {missing.length > 0 && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setSelected(selected.length === missing.length ? [] : missing.map((m: any) => m.copyId))}>
              {selected.length === missing.length ? "Deselect All" : "Select All"}
            </Button>
            <ConfirmDialog
              trigger={<Button size="sm" variant="destructive" disabled={selected.length === 0}>Withdraw Selected ({selected.length})</Button>}
              title={`Withdraw ${selected.length} copy/copies?`}
              description="These copies will be marked withdrawn and removed from availability. This is meant for items confirmed lost/missing during stock verification — this cannot be undone from this screen."
              confirmLabel="Withdraw"
              onConfirm={() => withdrawMutation.mutate(selected)}
            />
          </div>
        )}
      </div>
      {isLoading ? <RowListSkeleton count={4} /> : (
        <div className="space-y-1 max-h-[28rem] overflow-y-auto">
          {missing.length === 0 && <p className="text-sm text-slate-400 text-center py-8">Nothing missing — every active copy was verified.</p>}
          {missing.map((m: any) => (
            <label key={m.copyId} className="flex items-center gap-3 p-2 border rounded text-sm cursor-pointer hover:bg-slate-50">
              <input type="checkbox" checked={selected.includes(m.copyId)} onChange={() => toggle(m.copyId)} />
              <div className="flex-1">
                <p className="font-medium">{m.title}</p>
                <p className="text-xs text-slate-500">{m.barcode} {m.location && `· ${m.location}`}</p>
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function StockPage() {
  const qc = useQueryClient();
  const [sessionName, setSessionName] = useState("");
  const [activeSession, setActiveSession] = useState<any>(null);
  const [viewingSessionId, setViewingSessionId] = useState<number | null>(null);
  const [barcode, setBarcode] = useState("");
  const [scanResults, setScanResults] = useState<any[]>([]);

  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ["stock-sessions"],
    queryFn: () => axios.get("/api/stock-verification").then((r) => r.data),
  });

  const createSession = useMutation({
    mutationFn: (name: string) => axios.post("/api/stock-verification", { action: "create", sessionName: name }).then((r) => r.data),
    onSuccess: (sess) => { setActiveSession(sess); setScanResults([]); qc.invalidateQueries({ queryKey: ["stock-sessions"] }); toast.success("Session started"); },
  });

  const scanBarcode = useMutation({
    mutationFn: (barcodes: string[]) => axios.post("/api/stock-verification", { action: "scan", sessionId: activeSession.id, barcodes }).then((r) => r.data),
    onSuccess: (results) => { setScanResults(prev => [...results, ...prev]); },
  });

  const unscanMutation = useMutation({
    mutationFn: (copyId: number) => axios.post("/api/stock-verification", { action: "unscan", sessionId: activeSession.id, copyId }).then((r) => r.data),
    onSuccess: (_data, copyId) => {
      setScanResults((prev) => prev.filter((r) => r.copyId !== copyId));
      toast.success("Scan undone");
    },
  });

  const completeSession = useMutation({
    mutationFn: () => axios.post("/api/stock-verification", { action: "complete", sessionId: activeSession.id }).then((r) => r.data),
    onSuccess: (res) => {
      setActiveSession(null);
      toast.success(`Session completed — ${res.totalMissing} item(s) missing`);
      qc.invalidateQueries({ queryKey: ["stock-sessions"] });
    },
  });

  const cancelSession = useMutation({
    mutationFn: () => axios.post("/api/stock-verification", { action: "cancel", sessionId: activeSession.id }).then((r) => r.data),
    onSuccess: () => {
      setActiveSession(null);
      toast.success("Session abandoned");
      qc.invalidateQueries({ queryKey: ["stock-sessions"] });
    },
  });

  function handleScan(e: React.KeyboardEvent) {
    if (e.key === "Enter" && barcode.trim()) {
      scanBarcode.mutate([barcode.trim()]);
      setBarcode("");
    }
  }

  if (viewingSessionId) {
    return (
      <div className="flex flex-col h-full overflow-auto">
        <Header title="Stock Verification" />
        <div className="p-6 max-w-2xl">
          <MissingCopiesPanel sessionId={viewingSessionId} onBack={() => setViewingSessionId(null)} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header title="Stock Verification" />
      <div className="p-6 space-y-4">
        {!activeSession ? (
          <div className="space-y-4 max-w-lg">
            <div className="space-y-2">
              <Label>Session Name</Label>
              <div className="flex gap-2">
                <Input value={sessionName} onChange={(e) => setSessionName(e.target.value)} placeholder="e.g. Annual Stock Check 2024-25" />
                <Button onClick={() => createSession.mutate(sessionName)} disabled={!sessionName}>Start Session</Button>
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium text-sm">Past Sessions</h3>
              {sessionsLoading && <RowListSkeleton count={3} />}
              {(sessions ?? []).map((s: any) => (
                <Card
                  key={s.id}
                  className={s.status === "completed" ? "cursor-pointer hover:shadow-md transition-shadow" : ""}
                  onClick={() => s.status === "completed" && setViewingSessionId(s.id)}
                >
                  <CardContent className="pt-3 pb-3 flex justify-between items-center">
                    <div>
                      <p className="font-medium text-sm">{s.sessionName}</p>
                      <p className="text-xs text-slate-500">
                        {format(new Date(s.startedAt), "dd/MM/yyyy")} · {s.totalVerified}/{s.totalExpected} verified · {s.totalMissing} missing
                      </p>
                    </div>
                    <Badge variant={s.status === "completed" ? "default" : s.status === "cancelled" ? "secondary" : "outline"}>{s.status}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold">{activeSession.sessionName}</h2>
                <p className="text-sm text-slate-500">{scanResults.length} items scanned this session</p>
              </div>
              <div className="flex items-center gap-2">
                <ConfirmDialog
                  trigger={<Button variant="outline">Abandon Session</Button>}
                  title="Abandon this session?"
                  description="This stops the stock check without marking any copies missing. Scans recorded so far are kept for the record, but no items are withdrawn."
                  confirmLabel="Abandon"
                  onConfirm={() => cancelSession.mutate()}
                />
                <ConfirmDialog
                  trigger={<Button variant="destructive">Complete Session</Button>}
                  title="Complete this stock verification session?"
                  description="Any active copy not scanned during this session will be counted as missing. You'll be able to review and withdraw missing copies afterward."
                  confirmLabel="Complete"
                  onConfirm={() => completeSession.mutate()}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Scan Barcode (press Enter)</Label>
              <Input
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={handleScan}
                placeholder="Scan or type copy barcode"
                autoFocus
              />
            </div>
            <div className="max-h-80 overflow-y-auto space-y-1">
              {scanResults.map((r, i) => (
                <div key={i} className={`flex items-center justify-between p-2 rounded text-sm ${r.found ? "bg-green-50" : "bg-red-50"}`}>
                  <span>{r.barcode}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={r.found ? "default" : "destructive"}>{r.found ? "Found" : "Not Found"}</Badge>
                    {r.found && (
                      <button onClick={() => unscanMutation.mutate(r.copyId)} title="Undo this scan" className="text-slate-400 hover:text-slate-700">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
