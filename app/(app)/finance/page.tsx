"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { RowListSkeleton } from "@/components/ui/loading-cards";
import { Pagination } from "@/components/ui/pagination";
import { toast } from "sonner";
import { useForm, Controller } from "react-hook-form";
import { format } from "date-fns";
import { useSession } from "next-auth/react";
import { Edit, Trash2, Search } from "lucide-react";

function BudgetForm({ onSuccess }: { onSuccess: () => void }) {
  const { register, handleSubmit, control, reset, formState: { isSubmitting } } = useForm({
    defaultValues: { name: "", code: "", type: "expense", financialYear: `${new Date().getFullYear()}-${new Date().getFullYear()+1}`, department: "", allocatedAmount: "0", notes: "" }
  });

  async function onSubmit(data: any) {
    await axios.post("/api/finance/budget", data);
    toast.success("Budget head created");
    reset();
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label>Name *</Label><Input {...register("name", { required: true })} /></div>
        <div className="space-y-1"><Label>Code *</Label><Input {...register("code", { required: true })} placeholder="e.g. BOOKS-CS" /></div>
        <div className="space-y-1">
          <Label>Type</Label>
          <Controller name="type" control={control} render={({ field }) => (
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="income">Income</SelectItem>
              </SelectContent>
            </Select>
          )} />
        </div>
        <div className="space-y-1"><Label>Financial Year</Label><Input {...register("financialYear")} /></div>
        <div className="space-y-1"><Label>Department</Label><Input {...register("department")} /></div>
        <div className="space-y-1"><Label>Allocated Amount (₹)</Label><Input {...register("allocatedAmount")} type="number" step="0.01" /></div>
      </div>
      <div className="flex gap-2">
        <DialogClose render={<Button type="button" variant="outline" className="flex-1" />}>Cancel</DialogClose>
        <Button type="submit" className="flex-1" disabled={isSubmitting}>{isSubmitting ? "Creating..." : "Create Budget Head"}</Button>
      </div>
    </form>
  );
}

function EditBudgetForm({ budget, onSuccess }: { budget: any; onSuccess: () => void }) {
  const { register, handleSubmit, control, formState: { isSubmitting } } = useForm({
    defaultValues: {
      name: budget.name ?? "", code: budget.code ?? "", type: budget.type ?? "expense",
      financialYear: budget.financialYear ?? "", department: budget.department ?? "",
      allocatedAmount: budget.allocatedAmount ?? "0",
    }
  });

  async function onSubmit(data: any) {
    await axios.patch(`/api/finance/budget/${budget.id}`, data);
    toast.success("Budget head updated");
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label>Name *</Label><Input {...register("name", { required: true })} /></div>
        <div className="space-y-1"><Label>Code *</Label><Input {...register("code", { required: true })} /></div>
        <div className="space-y-1">
          <Label>Type</Label>
          <Controller name="type" control={control} render={({ field }) => (
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="income">Income</SelectItem>
              </SelectContent>
            </Select>
          )} />
        </div>
        <div className="space-y-1"><Label>Financial Year</Label><Input {...register("financialYear")} /></div>
        <div className="space-y-1"><Label>Department</Label><Input {...register("department")} /></div>
        <div className="space-y-1"><Label>Allocated Amount (₹)</Label><Input {...register("allocatedAmount")} type="number" step="0.01" /></div>
      </div>
      <div className="flex gap-2">
        <DialogClose render={<Button type="button" variant="outline" className="flex-1" />}>Cancel</DialogClose>
        <Button type="submit" className="flex-1" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save Changes"}</Button>
      </div>
    </form>
  );
}

export default function FinancePage() {
  const [openBudget, setOpenBudget] = useState(false);
  const [editingBudget, setEditingBudget] = useState<any>(null);
  const [fy, setFy] = useState(`${new Date().getFullYear()}-${new Date().getFullYear()+1}`);
  const qc = useQueryClient();
  const { data: session } = useSession();
  const role = (session?.user as any)?.role ?? "readonly";
  const canManageBudget = ["admin", "finance"].includes(role);

  const deleteBudget = useMutation({
    mutationFn: (id: number) => axios.delete(`/api/finance/budget/${id}`),
    onSuccess: () => { toast.success("Budget head removed"); qc.invalidateQueries({ queryKey: ["budgets"] }); },
    onError: (err: any) => toast.error(err.response?.data?.error ?? "Delete failed"),
  });

  const { data: budgets, isLoading: budgetsLoading } = useQuery({
    queryKey: ["budgets", fy],
    queryFn: () => axios.get(`/api/finance/budget?fy=${fy}`).then((r) => r.data),
  });

  const [finesSearch, setFinesSearch] = useState("");
  const [finesStatus, setFinesStatus] = useState("pending");
  const [finesPage, setFinesPage] = useState(1);
  const finesLimit = 50;

  const { data: finesData, isLoading: finesLoading } = useQuery({
    queryKey: ["fines", finesStatus, finesSearch, finesPage],
    queryFn: () => axios.get("/api/finance/fines", { params: { status: finesStatus === "all" ? undefined : finesStatus, q: finesSearch || undefined, page: finesPage, limit: finesLimit } }).then((r) => r.data),
  });
  const fines = finesData?.fines;

  const collectMutation = useMutation({
    mutationFn: (fineId: number) => axios.post("/api/finance/fines", { fineId, sendReceipt: true }).then((r) => r.data),
    onSuccess: () => { toast.success("Fine collected, receipt sent"); qc.invalidateQueries({ queryKey: ["fines"] }); },
    onError: (err: any) => toast.error(err.response?.data?.error ?? "Failed"),
  });

  const totalAllocated = (budgets ?? []).reduce((s: number, b: any) => s + Number(b.allocatedAmount), 0);
  const totalSpent = (budgets ?? []).reduce((s: number, b: any) => s + Number(b.spentAmount), 0);

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header title="Financial Accounting" />
      <div className="p-6 space-y-4">
        <Tabs defaultValue="budget">
          <TabsList><TabsTrigger value="budget">Budget Heads</TabsTrigger><TabsTrigger value="fines">Fine Collection</TabsTrigger></TabsList>
          <TabsContent value="budget" className="space-y-4">
            <div className="flex gap-3 items-center">
              <Input value={fy} onChange={(e) => setFy(e.target.value)} className="w-48" placeholder="Financial Year" />
              <Dialog open={openBudget} onOpenChange={setOpenBudget}>
                <DialogTrigger render={<Button />}>+ Add Budget Head</DialogTrigger>
                <DialogContent><DialogHeader><DialogTitle>New Budget Head</DialogTitle></DialogHeader>
                  <BudgetForm onSuccess={() => { setOpenBudget(false); qc.invalidateQueries({ queryKey: ["budgets"] }); }} />
                </DialogContent>
              </Dialog>
            </div>

            <Dialog open={!!editingBudget} onOpenChange={(o) => !o && setEditingBudget(null)}>
              <DialogContent>
                <DialogHeader><DialogTitle>Edit Budget Head</DialogTitle></DialogHeader>
                {editingBudget && (
                  <EditBudgetForm budget={editingBudget} onSuccess={() => { setEditingBudget(null); qc.invalidateQueries({ queryKey: ["budgets"] }); }} />
                )}
              </DialogContent>
            </Dialog>

            <div className="grid grid-cols-3 gap-4">
              <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Total Allocated</p><p className="text-2xl font-bold text-violet-600">₹{totalAllocated.toLocaleString()}</p></CardContent></Card>
              <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Total Spent</p><p className="text-2xl font-bold text-red-600">₹{totalSpent.toLocaleString()}</p></CardContent></Card>
              <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Balance</p><p className="text-2xl font-bold text-green-600">₹{(totalAllocated - totalSpent).toLocaleString()}</p></CardContent></Card>
            </div>
            <div className="space-y-2">
              {budgetsLoading && <RowListSkeleton count={3} />}
              {(budgets ?? []).map((b: any) => {
                const pct = b.allocatedAmount > 0 ? (Number(b.spentAmount) / Number(b.allocatedAmount)) * 100 : 0;
                return (
                  <Card key={b.id}>
                    <CardContent className="pt-3 pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-sm">{b.name}</p>
                          <p className="text-xs text-slate-500">{b.code} · {b.department} · {b.financialYear}</p>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="text-right text-sm">
                            <span className="font-medium">₹{Number(b.spentAmount).toLocaleString()}</span>
                            <span className="text-slate-400"> / ₹{Number(b.allocatedAmount).toLocaleString()}</span>
                          </div>
                          {canManageBudget && (
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon-sm" onClick={() => setEditingBudget(b)} title="Edit">
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <ConfirmDialog
                                trigger={<Button variant="ghost" size="icon-sm" title="Delete"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>}
                                title="Remove this budget head?"
                                description={`"${b.name}" will be deactivated. Historical spend data is preserved.`}
                                confirmLabel="Delete"
                                onConfirm={() => deleteBudget.mutate(b.id)}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 bg-slate-100 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-[#6D5DFB]"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
          <TabsContent value="fines" className="space-y-3">
            <div className="flex gap-3 items-center">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  className="pl-9"
                  placeholder="Search by USN, name, or membership no..."
                  value={finesSearch}
                  onChange={(e) => { setFinesSearch(e.target.value); setFinesPage(1); }}
                />
              </div>
              <Select value={finesStatus} onValueChange={(v) => { if (v) { setFinesStatus(v); setFinesPage(1); } }}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-slate-500">{finesData?.total ?? 0} fine(s)</p>
            {finesLoading && <RowListSkeleton count={3} />}
            {!finesLoading && (fines ?? []).length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">No fines match this search.</p>
            )}
            {(fines ?? []).map((f: any) => (
              <div key={f.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium text-sm">₹{Number(f.amount).toFixed(2)} <span className="text-slate-400 font-normal">— {f.memberName} ({f.rollNo ?? f.membershipNo})</span></p>
                  <p className="text-xs text-slate-500">{f.reason}</p>
                  <p className="text-xs text-slate-400">{format(new Date(f.createdAt), "dd/MM/yyyy")}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">{f.status}</Badge>
                  {f.status === "pending" && (
                    <ConfirmDialog
                      trigger={<Button size="sm">Collect</Button>}
                      title="Collect this fine?"
                      description={`This marks the ₹${Number(f.amount).toFixed(2)} fine as paid and immediately emails the member a receipt. Only confirm once payment has actually been received.`}
                      confirmLabel="Yes, Collect"
                      destructive={false}
                      onConfirm={() => collectMutation.mutate(f.id)}
                    />
                  )}
                </div>
              </div>
            ))}
            {!finesLoading && (fines ?? []).length > 0 && (
              <Pagination page={finesPage} onPageChange={setFinesPage} hasNext={(fines?.length ?? 0) >= finesLimit} total={finesData?.total} />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
