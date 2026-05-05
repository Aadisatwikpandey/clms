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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  draft: "secondary", approved: "default", sent: "default",
  partial: "outline", received: "default", cancelled: "destructive",
};

export default function AcquisitionsPage() {
  const [openPO, setOpenPO] = useState(false);
  const qc = useQueryClient();

  const { data: orders } = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: () => axios.get("/api/purchase-orders").then((r) => r.data),
  });

  const { data: vendors } = useQuery({
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

  function handleCreatePO(e: React.FormEvent) {
    e.preventDefault();
    createPO.mutate({ ...poForm, vendorId: parseInt(poForm.vendorId), items: poForm.items.map(item => ({ ...item, quantity: parseInt(String(item.quantity)) })) });
  }

  function addItem() {
    setPOForm(prev => ({ ...prev, items: [...prev.items, { title: "", authors: "", isbn: "", quantity: 1, unitPrice: "", discount: "0" }] }));
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
                        <div key={i} className="grid grid-cols-3 gap-2 p-2 border rounded">
                          <Input className="col-span-3" placeholder="Title *" value={item.title} onChange={(e) => setPOForm(p => ({ ...p, items: p.items.map((it, j) => j === i ? { ...it, title: e.target.value } : it) }))} required />
                          <Input placeholder="Authors" value={item.authors} onChange={(e) => setPOForm(p => ({ ...p, items: p.items.map((it, j) => j === i ? { ...it, authors: e.target.value } : it) }))} />
                          <Input placeholder="ISBN" value={item.isbn} onChange={(e) => setPOForm(p => ({ ...p, items: p.items.map((it, j) => j === i ? { ...it, isbn: e.target.value } : it) }))} />
                          <Input type="number" placeholder="Qty" min={1} value={item.quantity} onChange={(e) => setPOForm(p => ({ ...p, items: p.items.map((it, j) => j === i ? { ...it, quantity: parseInt(e.target.value) } : it) }))} />
                          <Input type="number" step="0.01" placeholder="Unit Price ₹" value={item.unitPrice} onChange={(e) => setPOForm(p => ({ ...p, items: p.items.map((it, j) => j === i ? { ...it, unitPrice: e.target.value } : it) }))} required />
                          <Input type="number" step="0.01" placeholder="Discount %" value={item.discount} onChange={(e) => setPOForm(p => ({ ...p, items: p.items.map((it, j) => j === i ? { ...it, discount: e.target.value } : it) }))} />
                        </div>
                      ))}
                    </div>
                    <Button type="submit" className="w-full" disabled={createPO.isPending}>
                      {createPO.isPending ? "Creating..." : "Create Purchase Order"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            <div className="space-y-3">
              {(orders ?? []).map((po: any) => (
                <Card key={po.id}>
                  <CardContent className="pt-3 pb-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{po.poNo}</p>
                      <p className="text-xs text-slate-500">Order Date: {po.orderDate} · Expected: {po.expectedDelivery ?? "—"}</p>
                    </div>
                    <div className="text-right space-y-1">
                      <Badge variant={STATUS_COLORS[po.status] as any}>{po.status}</Badge>
                      <p className="text-sm font-semibold">₹{Number(po.totalAmount).toLocaleString()}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="vendors" className="space-y-3">
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
