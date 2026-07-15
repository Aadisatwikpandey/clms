"use client";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RowListSkeleton } from "@/components/ui/loading-cards";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { CheckCircle, AlertTriangle, RotateCcw, Plus, X } from "lucide-react";

function IssuePanel() {
  const [memberBarcode, setMemberBarcode] = useState("");
  const [copyBarcodes, setCopyBarcodes] = useState<string[]>([]);
  const [currentBarcode, setCurrentBarcode] = useState("");
  const [result, setResult] = useState<any>(null);

  const issueMutation = useMutation({
    mutationFn: (data: any) => axios.post("/api/circulation/issue", data).then((r) => r.data),
    onSuccess: (data) => {
      setResult(data);
      if (data.issued.length > 0) toast.success(`Issued ${data.issued.length} item(s) successfully`);
      if (data.errors.length > 0) toast.warning(`${data.errors.length} item(s) could not be issued`);
      setCopyBarcodes([]);
      setCurrentBarcode("");
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? "Issue failed"),
  });

  function addBarcode(e: React.KeyboardEvent) {
    if (e.key === "Enter" && currentBarcode.trim()) {
      setCopyBarcodes((prev) => [...prev, currentBarcode.trim()]);
      setCurrentBarcode("");
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">Member Barcode / ID</label>
          <Input
            placeholder="Scan or type member barcode"
            value={memberBarcode}
            onChange={(e) => setMemberBarcode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && document.getElementById("copy-input")?.focus()}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Copy Barcode (press Enter to add)</label>
          <Input
            id="copy-input"
            placeholder="Scan copy barcode"
            value={currentBarcode}
            onChange={(e) => setCurrentBarcode(e.target.value)}
            onKeyDown={addBarcode}
          />
        </div>
      </div>

      {copyBarcodes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {copyBarcodes.map((b, i) => (
            <Badge key={i} variant="secondary" className="gap-1">
              {b}
              <X className="h-3 w-3 cursor-pointer" onClick={() => setCopyBarcodes((prev) => prev.filter((_, j) => j !== i))} />
            </Badge>
          ))}
        </div>
      )}

      <ConfirmDialog
        trigger={
          <Button
            disabled={!memberBarcode || copyBarcodes.length === 0 || issueMutation.isPending}
            className="w-full"
          >
            {issueMutation.isPending ? "Issuing..." : `Issue ${copyBarcodes.length} Item(s)`}
          </Button>
        }
        title={`Issue ${copyBarcodes.length} item(s) to ${memberBarcode}?`}
        description="This immediately issues the scanned copies to this member. Double-check the barcodes above before confirming."
        confirmLabel="Issue"
        destructive={false}
        onConfirm={() => issueMutation.mutate({ memberBarcode, copyBarcodes })}
      />

      {result && (
        <div className="space-y-2">
          {result.issued.map((item: any, i: number) => (
            <Alert key={i} className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 text-sm">
                Issued: {item.copy?.barcode} · Due: {item.dueDate}
              </AlertDescription>
            </Alert>
          ))}
          {result.errors.map((err: string, i: number) => (
            <Alert key={i} variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{err}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}
    </div>
  );
}

function ReturnPanel() {
  const [barcodes, setBarcodes] = useState<string[]>([]);
  const [current, setCurrent] = useState("");
  const [result, setResult] = useState<any>(null);

  const returnMutation = useMutation({
    mutationFn: (data: any) => axios.post("/api/circulation/return", data).then((r) => r.data),
    onSuccess: (data) => {
      setResult(data);
      if (data.returned.length > 0) toast.success(`Returned ${data.returned.length} item(s)`);
      setBarcodes([]);
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? "Return failed"),
  });

  function addBarcode(e: React.KeyboardEvent) {
    if (e.key === "Enter" && current.trim()) {
      setBarcodes((prev) => [...prev, current.trim()]);
      setCurrent("");
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium">Copy Barcode (press Enter to add)</label>
        <Input
          placeholder="Scan copy barcode"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          onKeyDown={addBarcode}
        />
      </div>
      {barcodes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {barcodes.map((b, i) => (
            <Badge key={i} variant="secondary" className="gap-1">
              {b}
              <X className="h-3 w-3 cursor-pointer" onClick={() => setBarcodes((prev) => prev.filter((_, j) => j !== i))} />
            </Badge>
          ))}
        </div>
      )}
      <ConfirmDialog
        trigger={
          <Button disabled={barcodes.length === 0 || returnMutation.isPending} className="w-full">
            {returnMutation.isPending ? "Processing..." : `Return ${barcodes.length} Item(s)`}
          </Button>
        }
        title={`Return ${barcodes.length} item(s)?`}
        description="This immediately marks the scanned copies as returned and calculates any overdue fines. Double-check the barcodes above before confirming."
        confirmLabel="Return"
        destructive={false}
        onConfirm={() => returnMutation.mutate({ copyBarcodes: barcodes })}
      />
      {result && (
        <div className="space-y-2">
          {result.returned.map((item: any, i: number) => (
            <Alert key={i} className={item.fineAmount > 0 ? "border-amber-200 bg-amber-50" : "border-green-200 bg-green-50"}>
              <CheckCircle className={`h-4 w-4 ${item.fineAmount > 0 ? "text-amber-600" : "text-green-600"}`} />
              <AlertDescription className="text-sm">
                Returned: {item.copy?.barcode}
                {item.fineAmount > 0 && ` · Fine: ₹${item.fineAmount}`}
              </AlertDescription>
            </Alert>
          ))}
          {result.errors.map((err: string, i: number) => (
            <Alert key={i} variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{err}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}
    </div>
  );
}

function RenewPanel() {
  const [barcode, setBarcode] = useState("");
  const [history, setHistory] = useState<any[]>([]);

  const renewMutation = useMutation({
    mutationFn: (copyBarcode: string) => axios.post("/api/circulation/renew", { copyBarcode }).then((r) => r.data),
    onSuccess: (data) => {
      setHistory((prev) => [{ ...data, barcode, at: new Date() }, ...prev]);
      toast.success(`Renewed — new due date ${data.newDueDate}`);
      setBarcode("");
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? "Renew failed"),
  });

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium">Copy Barcode (press Enter to renew)</label>
        <Input
          placeholder="Scan copy barcode"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && barcode.trim() && !renewMutation.isPending) renewMutation.mutate(barcode.trim());
          }}
        />
        <p className="text-xs text-slate-500">Renews the loan on this copy by the member's standard loan period, up to their max renewal limit.</p>
      </div>
      {history.length > 0 && (
        <div className="space-y-2">
          {history.map((h, i) => (
            <Alert key={i} className="border-blue-200 bg-blue-50">
              <RotateCcw className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-sm">
                Renewed {h.barcode} · New due date: {h.newDueDate}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}
    </div>
  );
}

function ReservationsPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["reservations"],
    queryFn: () => axios.get("/api/circulation/reservations").then((r) => r.data),
  });

  const cancelMutation = useMutation({
    mutationFn: (reservationId: number) => axios.patch("/api/circulation/reservations", { reservationId, action: "cancel" }).then((r) => r.data),
    onSuccess: () => toast.success("Reservation cancelled"),
    onError: (err: any) => toast.error(err.response?.data?.error ?? "Cancel failed"),
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">{data?.length ?? 0} active reservation(s)</p>
      {isLoading ? <RowListSkeleton count={4} /> : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {(data ?? []).length === 0 && <p className="text-sm text-slate-400 text-center py-8">No active reservations</p>}
          {(data ?? []).map((r: any) => (
            <div key={r.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium text-sm">{r.title}</p>
                <p className="text-xs text-slate-500">{r.memberName} ({r.membershipNo}) · Reserved {new Date(r.reservedAt).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={r.availableCopies > 0 ? "default" : "secondary"}>
                  {r.availableCopies > 0 ? "Ready to fulfil" : "Waiting"}
                </Badge>
                <ConfirmDialog
                  trigger={<Button size="sm" variant="outline">Cancel</Button>}
                  title="Cancel this reservation?"
                  description={`This removes ${r.memberName}'s hold on "${r.title}". They will need to reserve it again if they still want it.`}
                  confirmLabel="Cancel Reservation"
                  onConfirm={() => cancelMutation.mutate(r.id)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OverduesPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["overdues"],
    queryFn: () => axios.get("/api/circulation/overdues").then((r) => r.data),
  });

  const notifyMutation = useMutation({
    mutationFn: () => axios.post("/api/notifications", { action: "send_overdues" }).then((r) => r.data),
    onSuccess: (d) => toast.success(`Sent ${d.sent} overdue reminder(s)`),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-sm text-slate-600">{data?.length ?? 0} overdue items</span>
        <Button size="sm" variant="outline" onClick={() => notifyMutation.mutate()}>
          Send Email Reminders
        </Button>
      </div>
      {isLoading ? <RowListSkeleton count={4} /> : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {(data ?? []).map((row: any, i: number) => (
            <div key={i} className="flex items-center justify-between p-3 border rounded-lg bg-red-50 border-red-200">
              <div>
                <p className="font-medium text-sm">{row.title}</p>
                <p className="text-xs text-slate-500">{row.memberName} · Due: {row.dueDate}</p>
              </div>
              <div className="text-right">
                <Badge variant="destructive">{row.daysOverdue}d overdue</Badge>
                <p className="text-xs mt-1 text-red-700">Fine: ₹{row.fineAmount}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CirculationPage() {
  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header title="Circulation" />
      <div className="p-6">
        <Tabs defaultValue="issue">
          <TabsList className="mb-4">
            <TabsTrigger value="issue">Issue</TabsTrigger>
            <TabsTrigger value="return">Return</TabsTrigger>
            <TabsTrigger value="renew">Renew</TabsTrigger>
            <TabsTrigger value="reservations">Reservations</TabsTrigger>
            <TabsTrigger value="overdues">Overdues</TabsTrigger>
          </TabsList>
          <Card>
            <CardContent className="pt-6">
              <TabsContent value="issue"><IssuePanel /></TabsContent>
              <TabsContent value="return"><ReturnPanel /></TabsContent>
              <TabsContent value="renew"><RenewPanel /></TabsContent>
              <TabsContent value="reservations"><ReservationsPanel /></TabsContent>
              <TabsContent value="overdues"><OverduesPanel /></TabsContent>
            </CardContent>
          </Card>
        </Tabs>
      </div>
    </div>
  );
}
