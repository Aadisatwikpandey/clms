"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { RowListSkeleton } from "@/components/ui/loading-cards";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { Edit, Trash2 } from "lucide-react";

const ROLES = ["admin", "librarian", "staff", "member", "finance", "readonly"];

function EditUserForm({ user, onSuccess }: { user: any; onSuccess: () => void }) {
  const [form, setForm] = useState({ name: user.name ?? "", email: user.email ?? "", password: "" });
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload: Record<string, string> = { name: form.name, email: form.email };
      if (form.password) payload.password = form.password;
      await axios.patch(`/api/admin/users/${user.id}`, payload);
      toast.success("User updated");
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Update failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1"><Label>Full Name</Label><Input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} required /></div>
      <div className="space-y-1"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} required /></div>
      <div className="space-y-1">
        <Label>New Password</Label>
        <Input type="password" value={form.password} onChange={(e) => setForm(p => ({ ...p, password: e.target.value }))} placeholder="Leave blank to keep current password" minLength={8} />
      </div>
      <div className="flex gap-2">
        <DialogClose render={<Button type="button" variant="outline" className="flex-1" />}>Cancel</DialogClose>
        <Button type="submit" className="flex-1" disabled={submitting}>{submitting ? "Saving..." : "Save Changes"}</Button>
      </div>
    </form>
  );
}

function UserManagementTab() {
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "librarian" });
  const [editingUser, setEditingUser] = useState<any>(null);
  const qc = useQueryClient();
  const { data: session } = useSession();
  const currentUserId = parseInt((session?.user as any)?.id ?? "0");

  const { data: usersList, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => axios.get("/api/admin/users").then((r) => r.data),
  });

  const createUser = useMutation({
    mutationFn: (data: any) => axios.post("/api/admin/users", data).then((r) => r.data),
    onSuccess: () => {
      toast.success("User created");
      setNewUser({ name: "", email: "", password: "", role: "librarian" });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? "Failed"),
  });

  const updateUser = useMutation({
    mutationFn: ({ id, ...data }: any) => axios.patch(`/api/admin/users/${id}`, data).then((r) => r.data),
    onSuccess: () => { toast.success("User updated"); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (err: any) => toast.error(err.response?.data?.error ?? "Failed"),
  });

  const deleteUser = useMutation({
    mutationFn: (id: number) => axios.delete(`/api/admin/users/${id}`),
    onSuccess: () => { toast.success("User deleted"); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (err: any) => toast.error(err.response?.data?.error ?? "Delete failed"),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-sm">Create Staff Account</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); createUser.mutate(newUser); }} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Full Name</Label><Input value={newUser.name} onChange={(e) => setNewUser(p => ({ ...p, name: e.target.value }))} required /></div>
              <div className="space-y-1"><Label>Email</Label><Input type="email" value={newUser.email} onChange={(e) => setNewUser(p => ({ ...p, email: e.target.value }))} required /></div>
              <div className="space-y-1"><Label>Password</Label><Input type="password" value={newUser.password} onChange={(e) => setNewUser(p => ({ ...p, password: e.target.value }))} required /></div>
              <div className="space-y-1">
                <Label>Role</Label>
                <select className="w-full border rounded px-3 py-2 text-sm" value={newUser.role} onChange={(e) => setNewUser(p => ({ ...p, role: e.target.value }))}>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setNewUser({ name: "", email: "", password: "", role: "librarian" })}
              >
                Clear
              </Button>
              <Button type="submit" disabled={createUser.isPending}>{createUser.isPending ? "Creating..." : "Create User"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Dialog open={!!editingUser} onOpenChange={(o) => !o && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit User</DialogTitle></DialogHeader>
          {editingUser && (
            <EditUserForm user={editingUser} onSuccess={() => { setEditingUser(null); qc.invalidateQueries({ queryKey: ["admin-users"] }); }} />
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader><CardTitle className="text-sm">Existing Users</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <RowListSkeleton count={4} />}
          {(usersList ?? []).map((u: any) => {
            const isSelf = u.id === currentUserId;
            return (
              <div key={u.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium text-sm">{u.name}{isSelf && <span className="text-slate-400 font-normal"> (you)</span>}</p>
                  <p className="text-xs text-slate-500">{u.email}{u.lastLogin && ` · Last login: ${new Date(u.lastLogin).toLocaleDateString()}`}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={u.role} onValueChange={(v) => v && updateUser.mutate({ id: u.id, role: v })}>
                    <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button size="sm" variant="ghost" onClick={() => setEditingUser(u)} title="Edit name, email, or password">
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  {u.isActive ? (
                    <ConfirmDialog
                      trigger={<Button size="sm" variant="outline" disabled={isSelf}>Deactivate</Button>}
                      title="Deactivate this account?"
                      description={`${u.name} will no longer be able to log in. You can reactivate the account at any time.`}
                      confirmLabel="Deactivate"
                      onConfirm={() => updateUser.mutate({ id: u.id, isActive: false })}
                    />
                  ) : (
                    <>
                      <Badge variant="destructive">Inactive</Badge>
                      <Button size="sm" variant="outline" onClick={() => updateUser.mutate({ id: u.id, isActive: true })}>Reactivate</Button>
                    </>
                  )}
                  <ConfirmDialog
                    trigger={
                      <Button size="sm" variant="ghost" disabled={isSelf} title="Delete permanently">
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    }
                    title="Permanently delete this user?"
                    description={`${u.name}'s account will be removed entirely. If they have circulation, purchase, or audit history tied to their account, this will fail — deactivate instead in that case.`}
                    confirmLabel="Delete"
                    onConfirm={() => deleteUser.mutate(u.id)}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function NotificationsTab() {
  const { data: overdueCount } = useQuery({
    queryKey: ["notif-count", "overdues"],
    queryFn: () => axios.post("/api/notifications", { action: "count_overdues" }).then((r) => r.data),
  });
  const { data: vendorCount } = useQuery({
    queryKey: ["notif-count", "vendor"],
    queryFn: () => axios.post("/api/notifications", { action: "count_vendor_reminders" }).then((r) => r.data),
  });

  const sendOverdues = useMutation({
    mutationFn: () => axios.post("/api/notifications", { action: "send_overdues" }).then((r) => r.data),
    onSuccess: (d) => toast.success(`Sent ${d.sent} overdue notifications`),
  });

  const sendVendorReminders = useMutation({
    mutationFn: () => axios.post("/api/notifications", { action: "send_vendor_reminders" }).then((r) => r.data),
    onSuccess: (d) => toast.success(`Sent ${d.sent} vendor reminders`),
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Bulk Notifications</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between p-3 border rounded">
          <div>
            <p className="font-medium text-sm">Send Overdue Reminders</p>
            <p className="text-xs text-slate-500">
              {overdueCount ? `${overdueCount.count} member(s) with an email on file (${overdueCount.total} total with overdues)` : "Email all members with overdue items"}
            </p>
          </div>
          <ConfirmDialog
            trigger={<Button size="sm" disabled={sendOverdues.isPending}>Send</Button>}
            title="Send overdue reminder emails?"
            description={`This immediately emails ${overdueCount?.count ?? "all"} member(s) with an overdue-items notice. This cannot be recalled once sent.`}
            confirmLabel="Send Emails"
            destructive={false}
            onConfirm={() => sendOverdues.mutate()}
          />
        </div>
        <div className="flex items-center justify-between p-3 border rounded">
          <div>
            <p className="font-medium text-sm">Send Vendor Reminders</p>
            <p className="text-xs text-slate-500">
              {vendorCount ? `${vendorCount.count} vendor(s) with an email on file (${vendorCount.total} total overdue POs)` : "Email vendors with overdue purchase orders"}
            </p>
          </div>
          <ConfirmDialog
            trigger={<Button size="sm" disabled={sendVendorReminders.isPending}>Send</Button>}
            title="Send vendor reminder emails?"
            description={`This immediately emails ${vendorCount?.count ?? "all"} vendor(s) about overdue purchase orders. This cannot be recalled once sent.`}
            confirmLabel="Send Emails"
            destructive={false}
            onConfirm={() => sendVendorReminders.mutate()}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminPage() {
  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header title="System Administration" />
      <div className="p-6 max-w-3xl space-y-6">
        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users">User Management</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="system">System</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <UserManagementTab />
          </TabsContent>

          <TabsContent value="notifications">
            <NotificationsTab />
          </TabsContent>

          <TabsContent value="system">
            <Card>
              <CardHeader><CardTitle className="text-sm">System Info</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Version</span><span>CLMS v1.0</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Institution</span><span>AMC Engineering College</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Stack</span><span>Next.js 15 + PostgreSQL + Redis + Elasticsearch</span></div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
