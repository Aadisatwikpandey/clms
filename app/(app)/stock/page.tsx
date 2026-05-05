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
import { toast } from "sonner";
import { format } from "date-fns";

export default function StockPage() {
  const qc = useQueryClient();
  const [sessionName, setSessionName] = useState("");
  const [activeSession, setActiveSession] = useState<any>(null);
  const [barcode, setBarcode] = useState("");
  const [scanResults, setScanResults] = useState<any[]>([]);

  const { data: sessions } = useQuery({
    queryKey: ["stock-sessions"],
    queryFn: () => axios.get("/api/stock-verification").then((r) => r.data),
  });

  const createSession = useMutation({
    mutationFn: (name: string) => axios.post("/api/stock-verification", { action: "create", sessionName: name }).then((r) => r.data),
    onSuccess: (sess) => { setActiveSession(sess); qc.invalidateQueries({ queryKey: ["stock-sessions"] }); toast.success("Session started"); },
  });

  const scanBarcode = useMutation({
    mutationFn: (barcodes: string[]) => axios.post("/api/stock-verification", { action: "scan", sessionId: activeSession.id, barcodes }).then((r) => r.data),
    onSuccess: (results) => { setScanResults(prev => [...results, ...prev]); },
  });

  const completeSession = useMutation({
    mutationFn: () => axios.post("/api/stock-verification", { action: "complete", sessionId: activeSession.id }).then((r) => r.data),
    onSuccess: () => { setActiveSession(null); toast.success("Session completed"); qc.invalidateQueries({ queryKey: ["stock-sessions"] }); },
  });

  function handleScan(e: React.KeyboardEvent) {
    if (e.key === "Enter" && barcode.trim()) {
      scanBarcode.mutate([barcode.trim()]);
      setBarcode("");
    }
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
              {(sessions ?? []).map((s: any) => (
                <Card key={s.id}>
                  <CardContent className="pt-3 pb-3 flex justify-between items-center">
                    <div>
                      <p className="font-medium text-sm">{s.sessionName}</p>
                      <p className="text-xs text-slate-500">
                        {format(new Date(s.startedAt), "dd/MM/yyyy")} · {s.totalVerified}/{s.totalExpected} verified · {s.totalMissing} missing
                      </p>
                    </div>
                    <Badge variant={s.status === "completed" ? "default" : "secondary"}>{s.status}</Badge>
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
              <Button variant="destructive" onClick={() => completeSession.mutate()}>Complete Session</Button>
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
                  <Badge variant={r.found ? "default" : "destructive"}>{r.found ? "Found" : "Not Found"}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
