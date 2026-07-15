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
import { X, Eye } from "lucide-react";

function PODetailDialog({ poId, onClose }: { poId: number; onClose: () => void }) {
  const { data: po, isLoading } = useQuery({
    queryKey: ["purchase-order", poId],
    queryFn: () => axios.get(`/api/purchase-orders/${poId}`).then((r) => r.data),
  });

  if (isLoading) return <RowListSkeleton count={3} />;
  if (!po) return <p className="text-sm text-slate-500">Not found.</p>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><span className="text-slate-500">PO No:</span> <span className="font-medium">{po.poNo}</span></div>
        <div><span className="text-slate-500">Status:</span> <Badge variant={STATUS_COLORS[po.status] as any}>{po.status}</Badge></div>
        <div><span className="text-slate-500">Vendor:</span> {po.vendorName}</div>
        <div><span className="text-slate-500">Vendor Contact:</span> {po.vendorEmail ?? "—"} {po.vendorPhone && `· ${po.vendorPhone}`}</div>
        <div><span className="text-slate-500">Order Date:</span> {po.orderDate}</div>
        <div><span className="text-slate-500">Expected Delivery:</span> {po.expectedDelivery ?? "—"}</div>
        <div><span className="text-slate-500">Budget Head:</span> {po.budgetHeadName ? `${po.budgetHeadName} (${po.budgetHeadCode})` : "— not linked"}</div>
        <div><span className="text-slate-500">Total Amount:</span> <span className="font-semibold">₹{Number(po.totalAmount).toLocaleString()}</span></div>
        {po.invoiceNo && <div><span className="text-slate-500">Invoice:</span> {po.invoiceNo} · {po.invoiceDate}</div>}
        {Number(po.paidAmount) > 0 && <div><span className="text-slate-500">Paid:</span> ₹{Number(po.paidAmount).toLocaleString()}</div>}
      </div>
      {po.notes && <p className="text-sm text-slate-600 border-t pt-2">{po.notes}</p>}
      <div>
        <p className="text-sm font-medium mb-2">Line Items ({po.items.length})</p>
        <div className="space-y-1">
          {po.items.map((it: any) => (
            <div key={it.id} className="flex items-center justify-between p-2 border rounded text-sm">
              <div>
                <p>{it.title}</p>
                <p className="text-xs text-slate-500">{it.authors} {it.isbn && `· ISBN ${it.isbn}`}</p>
              </div>
              <div className="text-right text-xs text-slate-500">
                <p>{it.quantity} × ₹{Number(it.unitPrice).toLocaleString()}{Number(it.discount) > 0 && ` (−${it.discount}%)`}</p>
                <p className="font-medium text-slate-800">₹{Number(it.totalPrice).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <Button type="button" variant="outline" className="w-full" onClick={onClose}>Close</Button>
    </div>
  );
}

function VendorDetailDialog({ vendor, onClose }: { vendor: any; onClose: () => void }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-3">
        <div><span className="text-slate-500">Name:</span> <span className="font-medium">{vendor.name}</span></div>
        <div><span className="text-slate-500">Code:</span> {vendor.code ?? "—"}</div>
        <div><span className="text-slate-500">Contact Person:</span> {vendor.contactPerson ?? "—"}</div>
        <div><span className="text-slate-500">Email:</span> {vendor.email ?? "—"}</div>
        <div><span className="text-slate-500">Phone:</span> {vendor.phone ?? "—"}</div>
        <div><span className="text-slate-500">City:</span> {vendor.city ?? "—"}, {vendor.country}</div>
        <div><span className="text-slate-500">GST No.:</span> {vendor.gstNo ?? "—"}</div>
        <div><span className="text-slate-500">PAN No.:</span> {vendor.panNo ?? "—"}</div>
        <div><span className="text-slate-500">Total Orders:</span> {vendor.totalOrders ?? 0}</div>
        <div><span className="text-slate-500">Rating:</span> {vendor.rating ?? "—"} {vendor.deliveryRating && `(delivery: ${vendor.deliveryRating})`}</div>
      </div>
      {vendor.address && <div className="border-t pt-2"><span className="text-slate-500">Address:</span> {vendor.address}</div>}
      {vendor.notes && <div><span className="text-slate-500">Notes:</span> {vendor.notes}</div>}
      <Button type="button" variant="outline" className="w-full" onClick={onClose}>Close</Button>
    </div>
  );
}

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
  const [viewingPOId, setViewingPOId] = useState<number | null>(null);
  const [viewingVendor, setViewingVendor] = useState<any>(null);
  const qc = useQueryClient();

  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: () => axios.get("/api/purchase-orders").then((r) => r.data),
  });

  const { data: vendors, isLoading: vendorsLoading } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => axios.get("/api/vendors").then((r) => r.data),
  });

  const { data: budgetHeadsList } = useQuery({
    queryKey: ["budgets", "acquisitions"],
    queryFn: () => axios.get("/api/finance/budget").then((r) => r.data),
  });

  const [poForm, setPOForm] = useState({
    vendorId: "", budgetHeadId: "", orderDate: new Date().toISOString().split("T")[0], expectedDelivery: "", notes: "",
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
    createPO.mutate({
      ...poForm,
      vendorId: parseInt(poForm.vendorId),
      budgetHeadId: poForm.budgetHeadId ? parseInt(poForm.budgetHeadId) : undefined,
      items: poForm.items.map(item => ({ ...item, quantity: parseInt(String(item.quantity)) })),
    });
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
                      <div className="space-y-1 col-span-2">
                        <Label>Budget Head</Label>
                        <select className="w-full border rounded px-3 py-2 text-sm" value={poForm.budgetHeadId} onChange={(e) => setPOForm(p => ({ ...p, budgetHeadId: e.target.value }))}>
                          <option value="">No budget head (won't count against any allocation)</option>
                          {(budgetHeadsList ?? []).map((b: any) => (
                            <option key={b.id} value={b.id}>{b.name} — ₹{Number(b.spentAmount).toLocaleString()}/₹{Number(b.allocatedAmount).toLocaleString()} used</option>
                          ))}
                        </select>
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
                      <p className="font-medium text-sm">{po.poNo} <span className="text-slate-400 font-normal">· {po.vendorName}</span></p>
                      <p className="text-xs text-slate-500">
                        Order Date: {po.orderDate} · Expected: {po.expectedDelivery ?? "—"}
                        {po.budgetHeadName && ` · ${po.budgetHeadName}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right space-y-1">
                        <Badge variant={STATUS_COLORS[po.status] as any}>{po.status}</Badge>
                        <p className="text-sm font-semibold">₹{Number(po.totalAmount).toLocaleString()}</p>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => setViewingPOId(po.id)} title="View Details">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
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

            <Dialog open={!!viewingPOId} onOpenChange={(o) => !o && setViewingPOId(null)}>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Purchase Order Details</DialogTitle></DialogHeader>
                {viewingPOId && <PODetailDialog poId={viewingPOId} onClose={() => setViewingPOId(null)} />}
              </DialogContent>
            </Dialog>
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
                <CardContent className="pt-3 pb-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{v.name} {v.code && <span className="text-slate-400 font-normal">({v.code})</span>}</p>
                    <p className="text-xs text-slate-500">{v.email} · {v.phone} · {v.city}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setViewingVendor(v)} title="View Details">
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                </CardContent>
              </Card>
            ))}

            <Dialog open={!!viewingVendor} onOpenChange={(o) => !o && setViewingVendor(null)}>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Vendor Details</DialogTitle></DialogHeader>
                {viewingVendor && <VendorDetailDialog vendor={viewingVendor} onClose={() => setViewingVendor(null)} />}
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
