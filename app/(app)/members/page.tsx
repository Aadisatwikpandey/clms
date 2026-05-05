"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { useForm, Controller } from "react-hook-form";
import { format } from "date-fns";

function AddMemberForm({ onSuccess }: { onSuccess: () => void }) {
  const { register, handleSubmit, control, reset, formState: { isSubmitting } } = useForm({
    defaultValues: {
      name: "", memberType: "student", department: "", course: "", rollNo: "",
      email: "", phone: "", membershipEndDate: "", maxBooks: 3, maxDays: 14, maxRenewals: 2, finePerDay: "1.00",
    }
  });

  async function onSubmit(data: any) {
    await axios.post("/api/members", data);
    toast.success("Member registered successfully");
    reset();
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1">
          <Label>Full Name *</Label>
          <Input {...register("name", { required: true })} />
        </div>
        <div className="space-y-1">
          <Label>Member Type</Label>
          <Controller name="memberType" control={control} render={({ field }) => (
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["student","faculty","staff","external"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          )} />
        </div>
        <div className="space-y-1">
          <Label>Department</Label>
          <Input {...register("department")} />
        </div>
        <div className="space-y-1">
          <Label>Course</Label>
          <Input {...register("course")} placeholder="B.E. CSE" />
        </div>
        <div className="space-y-1">
          <Label>Roll No.</Label>
          <Input {...register("rollNo")} />
        </div>
        <div className="space-y-1">
          <Label>Email</Label>
          <Input {...register("email")} type="email" />
        </div>
        <div className="space-y-1">
          <Label>Phone</Label>
          <Input {...register("phone")} />
        </div>
        <div className="space-y-1">
          <Label>Membership End Date</Label>
          <Input {...register("membershipEndDate")} type="date" />
        </div>
        <div className="space-y-1">
          <Label>Max Books</Label>
          <Input {...register("maxBooks")} type="number" min={1} />
        </div>
        <div className="space-y-1">
          <Label>Loan Days</Label>
          <Input {...register("maxDays")} type="number" min={1} />
        </div>
        <div className="space-y-1">
          <Label>Max Renewals</Label>
          <Input {...register("maxRenewals")} type="number" min={0} />
        </div>
        <div className="space-y-1">
          <Label>Fine/Day (₹)</Label>
          <Input {...register("finePerDay")} type="number" step="0.50" />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Registering..." : "Register Member"}
      </Button>
    </form>
  );
}

export default function MembersPage() {
  const [search, setSearch] = useState("");
  const [memberType, setMemberType] = useState("all");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["members", search, memberType, page],
    queryFn: () => axios.get(`/api/members?q=${search}&type=${memberType === "all" ? "" : memberType}&page=${page}`).then((r) => r.data),
    placeholderData: (prev) => prev,
  });

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header title="Member Management" />
      <div className="p-6 space-y-4">
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input className="pl-9" placeholder="Search by name, membership no, email..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <Select value={memberType} onValueChange={(v) => { if (v !== null) setMemberType(v); setPage(1); }}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {["student","faculty","staff","external"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button />}>
              <Plus className="h-4 w-4 mr-1" /> Add Member
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Register New Member</DialogTitle></DialogHeader>
              <AddMemberForm onSuccess={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["members"] }); }} />
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? <p className="text-slate-500 text-sm">Loading...</p> : (
          <>
            <p className="text-xs text-slate-500">{data?.total ?? 0} members</p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {(data?.members ?? []).map((m: any) => (
                <Card key={m.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-4 pb-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="bg-blue-100 text-blue-700 rounded-full h-9 w-9 flex items-center justify-center font-bold text-sm">
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{m.name}</p>
                        <p className="text-xs text-slate-500">{m.membershipNo}</p>
                      </div>
                      {m.isSuspended ? (
                        <UserX className="h-4 w-4 text-red-500 shrink-0" />
                      ) : (
                        <UserCheck className="h-4 w-4 text-green-500 shrink-0" />
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 text-xs">
                      <Badge variant="outline" className="capitalize">{m.memberType}</Badge>
                      {m.department && <Badge variant="secondary">{m.department}</Badge>}
                    </div>
                    <div className="text-xs text-slate-500 space-y-0.5">
                      {m.email && <p>📧 {m.email}</p>}
                      {m.rollNo && <p>🎓 {m.rollNo}</p>}
                      {Number(m.totalFinesDue) > 0 && (
                        <p className="text-red-600 font-medium">Fine due: ₹{Number(m.totalFinesDue).toFixed(2)}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="flex gap-2 items-center pt-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <span className="text-sm text-slate-500">Page {page}</span>
              <Button variant="outline" size="sm" disabled={(data?.members?.length ?? 0) < 20} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
