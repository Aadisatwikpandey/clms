"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import axios from "axios";
import { format } from "date-fns";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { RowListSkeleton } from "@/components/ui/loading-cards";
import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";
import { ArrowLeft, UserCheck, UserX, Trash2, Edit } from "lucide-react";

function EditMemberForm({ member, onSuccess, onCancel }: { member: any; onSuccess: () => void; onCancel: () => void }) {
  const { register, handleSubmit, control, formState: { isSubmitting } } = useForm({
    defaultValues: {
      name: member.name ?? "", memberType: member.memberType ?? "student", department: member.department ?? "",
      course: member.course ?? "", rollNo: member.rollNo ?? "", email: member.email ?? "", phone: member.phone ?? "",
      maxBooks: member.maxBooks ?? 3, maxDays: member.maxDays ?? 14, maxRenewals: member.maxRenewals ?? 2,
      finePerDay: member.finePerDay ?? "1.00",
    }
  });

  async function onSubmit(data: any) {
    await axios.patch(`/api/members/${member.id}`, data);
    toast.success("Member updated");
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1"><Label>Full Name *</Label><Input {...register("name", { required: true })} /></div>
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
        <div className="space-y-1"><Label>Department</Label><Input {...register("department")} /></div>
        <div className="space-y-1"><Label>Course</Label><Input {...register("course")} /></div>
        <div className="space-y-1"><Label>Roll No.</Label><Input {...register("rollNo")} /></div>
        <div className="space-y-1"><Label>Email</Label><Input {...register("email")} type="email" /></div>
        <div className="space-y-1"><Label>Phone</Label><Input {...register("phone")} /></div>
        <div className="space-y-1"><Label>Max Books</Label><Input {...register("maxBooks")} type="number" min={1} /></div>
        <div className="space-y-1"><Label>Loan Days</Label><Input {...register("maxDays")} type="number" min={1} /></div>
        <div className="space-y-1"><Label>Max Renewals</Label><Input {...register("maxRenewals")} type="number" min={0} /></div>
        <div className="space-y-1"><Label>Fine/Day (₹)</Label><Input {...register("finePerDay")} type="number" step="0.50" /></div>
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button type="submit" className="flex-1" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save Changes"}</Button>
      </div>
    </form>
  );
}

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: session } = useSession();
  const role = (session?.user as any)?.role ?? "readonly";
  const canEdit = ["admin", "librarian", "staff"].includes(role);
  const canDelete = role === "admin";
  const [editing, setEditing] = useState(false);

  const { data: member, isLoading } = useQuery({
    queryKey: ["member", id],
    queryFn: () => axios.get(`/api/members/${id}`).then((r) => r.data),
  });

  const suspendMutation = useMutation({
    mutationFn: (isSuspended: boolean) => axios.patch(`/api/members/${id}`, { isSuspended }),
    onSuccess: (_data, isSuspended) => {
      toast.success(isSuspended ? "Member suspended" : "Member unsuspended");
      qc.invalidateQueries({ queryKey: ["member", id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => axios.delete(`/api/members/${id}`),
    onSuccess: () => {
      toast.success("Member removed");
      router.push("/members");
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? "Delete failed"),
  });

  const canCollectFine = ["admin", "librarian", "staff", "finance"].includes(role);
  const collectFineMutation = useMutation({
    mutationFn: (fineId: number) => axios.post("/api/finance/fines", { fineId, sendReceipt: true }),
    onSuccess: () => {
      toast.success("Fine collected, receipt sent");
      qc.invalidateQueries({ queryKey: ["member", id] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? "Failed"),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col h-full overflow-auto">
        <Header title="Member Profile" />
        <div className="p-6"><RowListSkeleton count={4} /></div>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="flex flex-col h-full overflow-auto">
        <Header title="Member Profile" />
        <div className="p-6 text-sm text-slate-500">Member not found.</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header title="Member Profile" />
      <div className="p-6 max-w-4xl space-y-4">
        <Link href="/members" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> Back to Members
        </Link>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-[#6D5DFB] to-[#8B7CFC] text-white rounded-full h-12 w-12 flex items-center justify-center font-bold text-lg">
                {member.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <CardTitle>{member.name}</CardTitle>
                <p className="text-sm text-slate-500">{member.membershipNo} · {member.barcode}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {member.isSuspended ? (
                <Badge variant="destructive"><UserX className="h-3 w-3 mr-1" /> Suspended</Badge>
              ) : (
                <Badge variant="default"><UserCheck className="h-3 w-3 mr-1" /> Active</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {editing ? (
              <EditMemberForm member={member} onCancel={() => setEditing(false)} onSuccess={() => { setEditing(false); qc.invalidateQueries({ queryKey: ["member", id] }); }} />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-slate-500">Type:</span> <span className="capitalize">{member.memberType}</span></div>
                  <div><span className="text-slate-500">Department:</span> {member.department ?? "—"}</div>
                  <div><span className="text-slate-500">Course:</span> {member.course ?? "—"}</div>
                  <div><span className="text-slate-500">Roll No.:</span> {member.rollNo ?? "—"}</div>
                  <div><span className="text-slate-500">Email:</span> {member.email ?? "—"}</div>
                  <div><span className="text-slate-500">Phone:</span> {member.phone ?? "—"}</div>
                  <div><span className="text-slate-500">Max Books:</span> {member.maxBooks}</div>
                  <div><span className="text-slate-500">Loan Days:</span> {member.maxDays}</div>
                  <div><span className="text-slate-500">Fine/Day:</span> ₹{Number(member.finePerDay).toFixed(2)}</div>
                  <div>
                    <span className="text-slate-500">Fines Due:</span>{" "}
                    <span className={Number(member.totalFinesDue) > 0 ? "text-red-600 font-medium" : ""}>
                      ₹{Number(member.totalFinesDue).toFixed(2)}
                    </span>
                  </div>
                </div>

                {(canEdit || canDelete) && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t">
                    {canEdit && (
                      <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                        <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                      </Button>
                    )}
                    {canEdit && (
                      <ConfirmDialog
                        trigger={
                          <Button size="sm" variant="outline">
                            {member.isSuspended ? <UserCheck className="h-3.5 w-3.5 mr-1" /> : <UserX className="h-3.5 w-3.5 mr-1" />}
                            {member.isSuspended ? "Unsuspend" : "Suspend"}
                          </Button>
                        }
                        title={member.isSuspended ? "Unsuspend this member?" : "Suspend this member?"}
                        description={
                          member.isSuspended
                            ? `${member.name} will regain full borrowing privileges.`
                            : `${member.name} will be blocked from borrowing until unsuspended. Use this for policy violations or lost ID cards.`
                        }
                        confirmLabel={member.isSuspended ? "Unsuspend" : "Suspend"}
                        destructive={!member.isSuspended}
                        onConfirm={() => suspendMutation.mutate(!member.isSuspended)}
                      />
                    )}
                    {canDelete && (
                      <ConfirmDialog
                        trigger={
                          <Button size="sm" variant="outline" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                          </Button>
                        }
                        title="Remove this member?"
                        description={`${member.name} will be deactivated and removed from the members list. Their transaction history is preserved.`}
                        confirmLabel="Delete"
                        onConfirm={() => deleteMutation.mutate()}
                      />
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Borrowing History</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(member.transactions ?? []).length === 0 && <p className="text-sm text-slate-400">No transactions yet.</p>}
            {(member.transactions ?? []).map((t: any) => (
              <div key={t.id} className="flex items-center justify-between p-2 border rounded text-sm">
                <div>
                  <p className="font-medium">{t.title}</p>
                  <p className="text-xs text-slate-500">{t.copyBarcode} · {t.transactionType}</p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  {t.issueDate && <p>Issued: {t.issueDate}</p>}
                  {t.returnDate ? <p className="text-green-600">Returned: {t.returnDate}</p> : t.dueDate && <p>Due: {t.dueDate}</p>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Fines</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(member.fines ?? []).length === 0 && <p className="text-sm text-slate-400">No fines on record.</p>}
            {(member.fines ?? []).map((f: any) => (
              <div key={f.id} className="flex items-center justify-between p-2 border rounded text-sm">
                <span>{f.reason}</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">₹{Number(f.amount).toFixed(2)}</span>
                  <Badge variant="outline" className="capitalize">{f.status}</Badge>
                  {f.status === "pending" && canCollectFine && (
                    <ConfirmDialog
                      trigger={<Button size="sm">Collect</Button>}
                      title="Collect this fine?"
                      description={`This marks the ₹${Number(f.amount).toFixed(2)} fine as paid and immediately emails ${member.name} a receipt. Only confirm once payment has actually been received.`}
                      confirmLabel="Yes, Collect"
                      destructive={false}
                      onConfirm={() => collectFineMutation.mutate(f.id)}
                    />
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Reservations</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(member.reservations ?? []).length === 0 && <p className="text-sm text-slate-400">No reservations.</p>}
            {(member.reservations ?? []).map((r: any) => (
              <div key={r.id} className="flex items-center justify-between p-2 border rounded text-sm">
                <span>{r.title}</span>
                <Badge variant="outline" className="capitalize">{r.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
