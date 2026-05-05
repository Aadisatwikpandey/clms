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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useForm, Controller } from "react-hook-form";

const FREQUENCIES = ["daily","weekly","fortnightly","monthly","quarterly","half_yearly","annually","irregular"];
const ISSUE_STATUS_COLORS: Record<string, string> = {
  expected: "secondary", received: "default", missing: "destructive", claimed: "outline", bound: "default"
};

export default function SerialsPage() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const qc = useQueryClient();

  const { data: serialsList } = useQuery({
    queryKey: ["serials"],
    queryFn: () => axios.get("/api/serials").then((r) => r.data),
  });

  const { data: issues } = useQuery({
    queryKey: ["serial-issues", selected?.id],
    queryFn: () => axios.get(`/api/serials/${selected.id}/issues`).then((r) => r.data),
    enabled: !!selected,
  });

  const { register, handleSubmit, control, reset, formState: { isSubmitting } } = useForm({
    defaultValues: { title: "", issn: "", publisher: "", frequency: "monthly", subscriptionStart: "", subscriptionEnd: "", annualCost: "", location: "", autoGenerateIssues: true, issueCount: 12 }
  });

  const createSerial = useMutation({
    mutationFn: (data: any) => axios.post("/api/serials", data).then((r) => r.data),
    onSuccess: () => { toast.success("Serial subscription added"); setOpen(false); reset(); qc.invalidateQueries({ queryKey: ["serials"] }); },
    onError: (err: any) => toast.error(err.response?.data?.error ?? "Failed"),
  });

  const updateIssue = useMutation({
    mutationFn: (data: any) => axios.patch(`/api/serials/${selected?.id}/issues`, data).then((r) => r.data),
    onSuccess: () => { toast.success("Issue updated"); qc.invalidateQueries({ queryKey: ["serial-issues"] }); },
  });

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header title="Serials & Journal Management" />
      <div className="p-6 flex gap-4">
        {/* Serials list */}
        <div className="w-72 shrink-0 space-y-3">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button className="w-full" />}>+ Add Journal</DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Add Serial Subscription</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit((d) => createSerial.mutate(d))} className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1"><Label>Title *</Label><Input {...register("title", { required: true })} /></div>
                  <div className="space-y-1"><Label>ISSN</Label><Input {...register("issn")} /></div>
                  <div className="space-y-1"><Label>Publisher</Label><Input {...register("publisher")} /></div>
                  <div className="space-y-1 col-span-2">
                    <Label>Frequency</Label>
                    <Controller name="frequency" control={control} render={({ field }) => (
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{FREQUENCIES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                      </Select>
                    )} />
                  </div>
                  <div className="space-y-1"><Label>Subscription Start</Label><Input {...register("subscriptionStart")} type="date" /></div>
                  <div className="space-y-1"><Label>Subscription End</Label><Input {...register("subscriptionEnd")} type="date" /></div>
                  <div className="space-y-1"><Label>Annual Cost (₹)</Label><Input {...register("annualCost")} type="number" step="0.01" /></div>
                  <div className="space-y-1"><Label>Expected Issues to Generate</Label><Input {...register("issueCount")} type="number" min={1} /></div>
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? "Adding..." : "Add Subscription"}</Button>
              </form>
            </DialogContent>
          </Dialog>
          {(serialsList ?? []).map((s: any) => (
            <Card key={s.id} className={`cursor-pointer transition-shadow hover:shadow-md ${selected?.id === s.id ? "ring-2 ring-blue-500" : ""}`} onClick={() => setSelected(s)}>
              <CardContent className="pt-3 pb-3">
                <p className="font-medium text-sm line-clamp-1">{s.title}</p>
                <p className="text-xs text-slate-500">{s.issn} · {s.frequency}</p>
                <Badge variant={s.isActive ? "default" : "secondary"} className="mt-1 text-xs">{s.isActive ? "Active" : "Inactive"}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Issues panel */}
        <div className="flex-1">
          {selected ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">{selected.title}</h2>
                  <p className="text-sm text-slate-500">{selected.publisher} · {selected.frequency}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 max-h-[70vh] overflow-y-auto">
                {(issues ?? []).map((issue: any) => (
                  <div key={issue.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Vol. {issue.volume} · Issue {issue.issueNo}</p>
                      <p className="text-xs text-slate-500">Expected: {issue.expectedDate}</p>
                      {issue.receivedDate && <p className="text-xs text-green-600">Received: {issue.receivedDate}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={ISSUE_STATUS_COLORS[issue.status] as any}>{issue.status}</Badge>
                      {issue.status === "expected" && (
                        <Button size="sm" variant="outline" onClick={() => updateIssue.mutate({ issueId: issue.id, status: "received", receivedDate: new Date().toISOString().split("T")[0] })}>
                          Mark Received
                        </Button>
                      )}
                      {issue.status === "expected" && (
                        <Button size="sm" variant="destructive" onClick={() => updateIssue.mutate({ issueId: issue.id, status: "missing" })}>
                          Missing
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-slate-400">
              Select a journal to view its issues
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
