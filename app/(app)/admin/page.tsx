"use client";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export default function AdminPage() {
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "librarian" });

  const createUser = useMutation({
    mutationFn: (data: any) => axios.post("/api/admin/users", data).then((r) => r.data),
    onSuccess: () => { toast.success("User created"); setNewUser({ name: "", email: "", password: "", role: "librarian" }); },
    onError: (err: any) => toast.error(err.response?.data?.error ?? "Failed"),
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
                        {["admin","librarian","staff","member","finance","readonly"].map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  </div>
                  <Button type="submit" disabled={createUser.isPending}>Create User</Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card>
              <CardHeader><CardTitle className="text-sm">Bulk Notifications</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <p className="font-medium text-sm">Send Overdue Reminders</p>
                    <p className="text-xs text-slate-500">Email all members with overdue items</p>
                  </div>
                  <Button size="sm" onClick={() => sendOverdues.mutate()} disabled={sendOverdues.isPending}>Send</Button>
                </div>
                <div className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <p className="font-medium text-sm">Send Vendor Reminders</p>
                    <p className="text-xs text-slate-500">Email vendors with overdue purchase orders</p>
                  </div>
                  <Button size="sm" onClick={() => sendVendorReminders.mutate()} disabled={sendVendorReminders.isPending}>Send</Button>
                </div>
              </CardContent>
            </Card>
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
