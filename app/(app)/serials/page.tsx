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
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RowListSkeleton } from "@/components/ui/loading-cards";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { useForm, Controller } from "react-hook-form";
import { useSession } from "next-auth/react";
import { Edit, Trash2 } from "lucide-react";

const FREQUENCIES = ["daily","weekly","fortnightly","monthly","quarterly","half_yearly","annually","irregular"];
const ISSUE_STATUS_COLORS: Record<string, string> = {
  expected: "secondary", received: "default", missing: "destructive", claimed: "outline", bound: "default"
};

function IssueToMemberForm({ issue, serialId, onSuccess }: { issue: any; serialId: number; onSuccess: () => void }) {
  const [barcode, setBarcode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await axios.post(`/api/serials/${serialId}/issues`, { issueId: issue.id, action: "issue", memberBarcode: barcode });
      toast.success(`Issued to ${res.data.member.name}`);
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Failed to issue");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1">
        <Label>Member Barcode / USN</Label>
        <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Scan or type member barcode" autoFocus required />
        <p className="text-xs text-slate-500">Due back in 3 days (reading-room loan period).</p>
      </div>
      <div className="flex gap-2">
        <DialogClose render={<Button type="button" variant="outline" className="flex-1" />}>Cancel</DialogClose>
        <Button type="submit" className="flex-1" disabled={submitting || !barcode}>{submitting ? "Issuing..." : "Issue"}</Button>
      </div>
    </form>
  );
}

function EditSerialForm({ serial, onSuccess }: { serial: any; onSuccess: (updated: any) => void }) {
  const { register, handleSubmit, control, formState: { isSubmitting } } = useForm({
    defaultValues: {
      title: serial.title ?? "", issn: serial.issn ?? "", publisher: serial.publisher ?? "",
      frequency: serial.frequency ?? "monthly", subscriptionStart: serial.subscriptionStart ?? "",
      subscriptionEnd: serial.subscriptionEnd ?? "", annualCost: serial.annualCost ?? "", location: serial.location ?? "",
    }
  });

  async function onSubmit(data: any) {
    const res = await axios.patch(`/api/serials/${serial.id}`, data);
    toast.success("Serial updated");
    onSuccess(res.data);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
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
        <div className="space-y-1"><Label>Location</Label><Input {...register("location")} /></div>
      </div>
      <div className="flex gap-2">
        <DialogClose render={<Button type="button" variant="outline" className="flex-1" />}>Cancel</DialogClose>
        <Button type="submit" className="flex-1" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save Changes"}</Button>
      </div>
    </form>
  );
}

export default function SerialsPage() {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [issuingTo, setIssuingTo] = useState<any>(null);
  const [selected, setSelected] = useState<any>(null);
  const qc = useQueryClient();
  const { data: session } = useSession();
  const role = (session?.user as any)?.role ?? "readonly";
  const canEdit = ["admin", "librarian", "staff"].includes(role);
  const canDelete = role === "admin";

  const deleteSerial = useMutation({
    mutationFn: (id: number) => axios.delete(`/api/serials/${id}`),
    onSuccess: () => {
      toast.success("Serial removed");
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["serials"] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? "Delete failed"),
  });

  const { data: serialsList, isLoading: serialsLoading } = useQuery({
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

  const returnIssue = useMutation({
    mutationFn: (issueId: number) => axios.post(`/api/serials/${selected?.id}/issues`, { issueId, action: "return" }).then((r) => r.data),
    onSuccess: () => { toast.success("Issue returned"); qc.invalidateQueries({ queryKey: ["serial-issues"] }); },
    onError: (err: any) => toast.error(err.response?.data?.error ?? "Failed"),
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
                <div className="flex gap-2">
                  <DialogClose render={<Button type="button" variant="outline" className="flex-1" />}>Cancel</DialogClose>
                  <Button type="submit" className="flex-1" disabled={isSubmitting}>{isSubmitting ? "Adding..." : "Add Subscription"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          {serialsLoading && <RowListSkeleton count={3} />}
          {(serialsList ?? []).map((s: any) => (
            <Card key={s.id} className={`cursor-pointer transition-shadow hover:shadow-md rounded-2xl ${selected?.id === s.id ? "ring-2 ring-[#6D5DFB]" : ""}`} onClick={() => setSelected(s)}>
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
                {(canEdit || canDelete) && (
                  <div className="flex items-center gap-2">
                    {canEdit && (
                      <Dialog open={editOpen} onOpenChange={setEditOpen}>
                        <DialogTrigger render={<Button size="sm" variant="outline" />}><Edit className="h-3.5 w-3.5 mr-1" /> Edit</DialogTrigger>
                        <DialogContent className="max-w-lg">
                          <DialogHeader><DialogTitle>Edit Serial Subscription</DialogTitle></DialogHeader>
                          <EditSerialForm serial={selected} onSuccess={(updated) => { setEditOpen(false); setSelected(updated); qc.invalidateQueries({ queryKey: ["serials"] }); }} />
                        </DialogContent>
                      </Dialog>
                    )}
                    {canDelete && (
                      <ConfirmDialog
                        trigger={<Button size="sm" variant="outline"><Trash2 className="h-3.5 w-3.5 mr-1 text-destructive" /> Delete</Button>}
                        title="Remove this subscription?"
                        description={`"${selected.title}" will be marked inactive. Its issue history is preserved.`}
                        confirmLabel="Delete"
                        onConfirm={() => deleteSerial.mutate(selected.id)}
                      />
                    )}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2 max-h-[70vh] overflow-y-auto">
                {(issues ?? []).map((issue: any) => {
                  const checkedOut = issue.issuedToMemberId && !issue.returnedAt;
                  const canCirculate = ["received", "bound"].includes(issue.status);
                  return (
                    <div key={issue.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="text-sm font-medium">Vol. {issue.volume} · Issue {issue.issueNo}</p>
                        <p className="text-xs text-slate-500">Expected: {issue.expectedDate}</p>
                        {issue.receivedDate && <p className="text-xs text-green-600">Received: {issue.receivedDate}</p>}
                        {checkedOut && (
                          <p className="text-xs text-amber-600">Issued to {issue.issuedToName} ({issue.issuedToRollNo}) · Due {issue.dueDate}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={ISSUE_STATUS_COLORS[issue.status] as any}>{issue.status}</Badge>
                        {issue.status === "expected" && (
                          <ConfirmDialog
                            trigger={<Button size="sm" variant="outline">Mark Received</Button>}
                            title="Mark this issue as received?"
                            description={`Vol. ${issue.volume} · Issue ${issue.issueNo} will be recorded as received today.`}
                            confirmLabel="Mark Received"
                            destructive={false}
                            onConfirm={() => updateIssue.mutate({ issueId: issue.id, status: "received", receivedDate: new Date().toISOString().split("T")[0] })}
                          />
                        )}
                        {issue.status === "expected" && (
                          <ConfirmDialog
                            trigger={<Button size="sm" variant="destructive">Missing</Button>}
                            title="Mark this issue as missing?"
                            description={`Vol. ${issue.volume} · Issue ${issue.issueNo} will be flagged missing so it can be claimed from the publisher/vendor.`}
                            confirmLabel="Mark Missing"
                            onConfirm={() => updateIssue.mutate({ issueId: issue.id, status: "missing" })}
                          />
                        )}
                        {canCirculate && !checkedOut && (
                          <Button size="sm" variant="outline" onClick={() => setIssuingTo(issue)}>Issue to Member</Button>
                        )}
                        {checkedOut && (
                          <Button size="sm" variant="outline" onClick={() => returnIssue.mutate(issue.id)}>Return</Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <Dialog open={!!issuingTo} onOpenChange={(o) => !o && setIssuingTo(null)}>
                <DialogContent className="max-w-sm">
                  <DialogHeader><DialogTitle>Issue to Member</DialogTitle></DialogHeader>
                  {issuingTo && (
                    <IssueToMemberForm
                      issue={issuingTo}
                      serialId={selected.id}
                      onSuccess={() => { setIssuingTo(null); qc.invalidateQueries({ queryKey: ["serial-issues"] }); }}
                    />
                  )}
                </DialogContent>
              </Dialog>
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
