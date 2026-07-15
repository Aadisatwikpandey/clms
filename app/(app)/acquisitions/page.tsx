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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RowListSkeleton } from "@/components/ui/loading-cards";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { X } from "lucide-react";

function AddVendorForm({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState({ name: "", code: "", contactPerson: "", email: "", phone: "", address: "", city: "", gstNo: "" });
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await axios.post("/api/vendors", form);
      toast.success("Vendor added");
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Failed to add vendor");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} required /></div>
        <div className="space-y-1"><Label>Code</Label><Input value={form.code} onChange={(e) => setForm(p => ({ ...p, code: e.target.value }))} /></div>
        <div className="space-y-1"><Label>Contact Person</Label><Input value={form.contactPerson} onChange={(e) => setForm(p => ({ ...p, contactPerson: e.target.value }))} /></div>
        <div className="space-y-1"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} /></div>
        <div className="space-y-1"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
        <div className="space-y-1"><Label>City</Label><Input value={form.city} onChange={(e) => setForm(p => ({ ...p, city: e.target.value }))} /></div>
        <div className="space-y-1"><Label>GST No.</Label><Input value={form.gstNo} onChange={(e) => setForm(p => ({ ...p, gstNo: e.target.value }))} /></div>
        <div className="col-span-2 space-y-1"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm(p => ({ ...p, address: e.target.value }))} /></div>
      </div>
      <div className="flex gap-2">
        <DialogClose render={<Button type="button" variant="outline" className="flex-1" />}>Cancel</DialogClose>
        <Button type="submit" className="flex-1" disabled={submitting}>{submitting ? "Adding..." : "Add Vendor"}</Button>
      </div>
    </form>
  );
}

const STATUS_COLORS: Record<string, string> = {
  draft: "secondary", approved: "default", sent: "default",
  partial: "outline", received: "default", cancelled: "destructive",
};

export default function AcquisitionsPage() {
  const [openPO, setOpenPO] = useState(false);
  const [openVendor, setOpenVendor] = useState(false);
  const qc = useQueryClient();

  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: () => axios.get("/api/purchase-orders").then((r) => r.data),
  });

  const { data: vendors, isLoading: vendorsLoading } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => axios.get("/api/vendors").then((r) => r.data),
  });

  const [poForm, setPOForm] = useState({
    vendorId: "", orderDate: new Date().toISOString().split("T")[0], expectedDelivery: "", notes: "",
    items: [{ title: "", authors: "", isbn: "", quantity: 1, unitPrice: "", discount: "0" }],
  });

  const createPO = useMutation({
    mutationFn: (data: any) => axios.post("/api/purchase-orders", data).then((r) => r.data),
    onSuccess: () => { toast.success("Purchase order created"); setOpenPO(false); qc.invalidateQueries({ queryKey: ["purchase-orders"] }); },
    onError: (err: any) => toast.error(err.response?.data?.error ?? "Failed to create PO"),
  });

  const cancelPO = useMutation({
    mutationFn: (id: number) => axios.patch(`/api/purchase-orders/${id}`, { status: "cancelled" }).then((r) => r.data),
    onSuccess: () => { toast.success("Purchase order cancelled"); qc.invalidateQueries({ queryKey: ["purchase-orders"] }); },
    onError: (err: any) => toast.error(err.response?.data?.error ?? "Cancel failed"),
  });

  function handleCreatePO(e: React.FormEvent) {
    e.preventDefault();
    createPO.mutate({ ...poForm, vendorId: parseInt(poForm.vendorId), items: poForm.items.map(item => ({ ...item, quantity: parseInt(String(item.quantity)) })) });
  }

  function addItem() {
    setPOForm(prev => ({ ...prev, items: [...prev.items, { title: "", authors: "", isbn: "", quantity: 1, unitPrice: "", discount: "0" }] }));
  }

  function removeItem(index: number) {
    setPOForm(prev => ({ ...prev, items: prev.items.filter((_, j) => j !== index) }));
  }

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header title="Acquisitions & Purchase Orders" />
      <div className="p-6 space-y-4">
        <Tabs defaultValue="orders">
          <TabsList>
            <TabsTrigger value="orders">Purchase Orders</TabsTrigger>
            <TabsTrigger value="vendors">Vendors</TabsTrigger>
          </TabsList>
          <TabsContent value="orders" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={openPO} onOpenChange={setOpenPO}>
                <DialogTrigger render={<Button />}>+ New Purchase Order</DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>Create Purchase Order</DialogTitle></DialogHeader>
                  <form onSubmit={handleCreatePO} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1 col-span-2">
                        <Label>Vendor *</Label>
                        <select className="w-full border rounded px-3 py-2 text-sm" value={poForm.vendorId} onChange={(e) => setPOForm(p => ({ ...p, vendorId: e.target.value }))} required>
                          <option value="">Select vendor</option>
                          {(vendors ?? []).map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label>Order Date</Label>
                        <Input type="date" value={poForm.orderDate} onChange={(e) => setPOForm(p => ({ ...p, orderDate: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label>Expected Delivery</Label>
                        <Input type="date" value={poForm.expectedDelivery} onChange={(e) => setPOForm(p => ({ ...p, expectedDelivery: e.target.value }))} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Items</Label>
                        <Button type="button" size="sm" variant="outline" onClick={addItem}>+ Add Item</Button>
                      </div>
                      {poForm.items.map((item, i) => (
                        <div key={i} className="grid grid-cols-3 gap-2 p-2 border rounded relative">
                          {poForm.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItem(i)}
                              className="absolute -top-2 -right-2 bg-white border rounded-full p-0.5 shadow-sm hover:bg-slate-50"
                              title="Remove item"
                            >
                              <X className="h-3 w-3 text-slate-500" />
                            </button>
                          )}
                          <Input className="col-span-3" placeholder="Title *" value={item.title} onChange={(e) => setPOForm(p => ({ ...p, items: p.items.map((it, j) => j === i ? { ...it, title: e.target.value } : it) }))} required />
                          <Input placeholder="Authors" value={item.authors} onChange={(e) => setPOForm(p => ({ ...p, items: p.items.map((it, j) => j === i ? { ...it, authors: e.target.value } : it) }))} />
                          <Input placeholder="ISBN" value={item.isbn} onChange={(e) => setPOForm(p => ({ ...p, items: p.items.map((it, j) => j === i ? { ...it, isbn: e.target.value } : it) }))} />
                          <Input type="number" placeholder="Qty" min={1} value={item.quantity} onChange={(e) => setPOForm(p => ({ ...p, items: p.items.map((it, j) => j === i ? { ...it, quantity: parseInt(e.target.value) } : it) }))} />
                          <Input type="number" step="0.01" placeholder="Unit Price ₹" value={item.unitPrice} onChange={(e) => setPOForm(p => ({ ...p, items: p.items.map((it, j) => j === i ? { ...it, unitPrice: e.target.value } : it) }))} required />
                          <Input type="number" step="0.01" placeholder="Discount %" value={item.discount} onChange={(e) => setPOForm(p => ({ ...p, items: p.items.map((it, j) => j === i ? { ...it, discount: e.target.value } : it) }))} />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <DialogClose render={<Button type="button" variant="outline" className="flex-1" />}>Cancel</DialogClose>
                      <Button type="submit" className="flex-1" disabled={createPO.isPending}>
                        {createPO.isPending ? "Creating..." : "Create Purchase Order"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            <div className="space-y-3">
              {ordersLoading && <RowListSkeleton count={3} />}
              {(orders ?? []).map((po: any) => (
                <Card key={po.id}>
                  <CardContent className="pt-3 pb-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{po.poNo}</p>
                      <p className="text-xs text-slate-500">Order Date: {po.orderDate} · Expected: {po.expectedDelivery ?? "—"}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right space-y-1">
                        <Badge variant={STATUS_COLORS[po.status] as any}>{po.status}</Badge>
                        <p className="text-sm font-semibold">₹{Number(po.totalAmount).toLocaleString()}</p>
                      </div>
                      {!["received", "cancelled"].includes(po.status) && (
                        <ConfirmDialog
                          trigger={<Button size="sm" variant="outline">Cancel PO</Button>}
                          title={`Cancel ${po.poNo}?`}
                          description="This marks the purchase order as cancelled and releases any budget reserved against it. This cannot be undone from here."
                          confirmLabel="Cancel Order"
                          onConfirm={() => cancelPO.mutate(po.id)}
                        />
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="vendors" className="space-y-3">
            <div className="flex justify-end">
              <Dialog open={openVendor} onOpenChange={setOpenVendor}>
                <DialogTrigger render={<Button />}>+ Add Vendor</DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader><DialogTitle>Add Vendor</DialogTitle></DialogHeader>
                  <AddVendorForm onSuccess={() => { setOpenVendor(false); qc.invalidateQueries({ queryKey: ["vendors"] }); }} />
                </DialogContent>
              </Dialog>
            </div>
            {vendorsLoading && <RowListSkeleton count={3} />}
            {(vendors ?? []).map((v: any) => (
              <Card key={v.id}>
                <CardContent className="pt-3 pb-3">
                  <p className="font-medium text-sm">{v.name}</p>
                  <p className="text-xs text-slate-500">{v.email} · {v.phone} · {v.city}</p>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
