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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useForm, Controller } from "react-hook-form";
import { format } from "date-fns";

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
      <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? "Creating..." : "Create Budget Head"}</Button>
    </form>
  );
}

export default function FinancePage() {
  const [openBudget, setOpenBudget] = useState(false);
  const [fy, setFy] = useState(`${new Date().getFullYear()}-${new Date().getFullYear()+1}`);
  const qc = useQueryClient();

  const { data: budgets } = useQuery({
    queryKey: ["budgets", fy],
    queryFn: () => axios.get(`/api/finance/budget?fy=${fy}`).then((r) => r.data),
  });

  const { data: fines } = useQuery({
    queryKey: ["fines", "pending"],
    queryFn: () => axios.get("/api/finance/fines?status=pending").then((r) => r.data),
  });

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
            <div className="grid grid-cols-3 gap-4">
              <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Total Allocated</p><p className="text-2xl font-bold text-blue-600">₹{totalAllocated.toLocaleString()}</p></CardContent></Card>
              <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Total Spent</p><p className="text-2xl font-bold text-red-600">₹{totalSpent.toLocaleString()}</p></CardContent></Card>
              <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Balance</p><p className="text-2xl font-bold text-green-600">₹{(totalAllocated - totalSpent).toLocaleString()}</p></CardContent></Card>
            </div>
            <div className="space-y-2">
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
                        <div className="text-right text-sm">
                          <span className="font-medium">₹{Number(b.spentAmount).toLocaleString()}</span>
                          <span className="text-slate-400"> / ₹{Number(b.allocatedAmount).toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="mt-2 bg-slate-100 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-blue-500"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
          <TabsContent value="fines" className="space-y-3">
            <p className="text-sm text-slate-500">{(fines ?? []).length} pending fines</p>
            {(fines ?? []).map((f: any) => (
              <div key={f.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium text-sm">₹{Number(f.amount).toFixed(2)}</p>
                  <p className="text-xs text-slate-500">{f.reason}</p>
                  <p className="text-xs text-slate-400">{format(new Date(f.createdAt), "dd/MM/yyyy")}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">{f.status}</Badge>
                  {f.status === "pending" && (
                    <Button size="sm" onClick={() => collectMutation.mutate(f.id)}>Collect</Button>
                  )}
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
