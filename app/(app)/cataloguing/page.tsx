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
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, BookOpen, Edit } from "lucide-react";
import { toast } from "sonner";
import { useForm, Controller } from "react-hook-form";

const MATERIAL_TYPES = ["book","journal","magazine","newspaper","av_material","map","manuscript","thesis","digital","other"];

function AddBookForm({ onSuccess }: { onSuccess: () => void }) {
  const { register, handleSubmit, control, reset, formState: { isSubmitting } } = useForm({
    defaultValues: { title: "", authors: "", publisher: "", publicationYear: "", isbn: "", deweyNo: "", callNumber: "", subjects: "", language: "English", pages: "", price: "", location: "", shelfNo: "", edition: "", abstract: "", notes: "", copies: 1, materialType: "book" }
  });

  const onSubmit = async (data: any) => {
    await axios.post("/api/books", {
      ...data,
      authors: data.authors ? data.authors.split(";").map((a: string) => a.trim()) : [],
      subjects: data.subjects ? data.subjects.split(";").map((s: string) => s.trim()) : [],
      publicationYear: data.publicationYear ? parseInt(data.publicationYear) : undefined,
      pages: data.pages ? parseInt(data.pages) : undefined,
      copies: parseInt(data.copies),
    });
    toast.success("Book added successfully");
    reset();
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1">
          <Label>Title *</Label>
          <Input {...register("title", { required: true })} placeholder="Book title" />
        </div>
        <div className="space-y-1">
          <Label>Authors (semicolon-separated)</Label>
          <Input {...register("authors")} placeholder="Author One; Author Two" />
        </div>
        <div className="space-y-1">
          <Label>Material Type</Label>
          <Controller name="materialType" control={control} render={({ field }) => (
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MATERIAL_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          )} />
        </div>
        <div className="space-y-1">
          <Label>Publisher</Label>
          <Input {...register("publisher")} />
        </div>
        <div className="space-y-1">
          <Label>Year</Label>
          <Input {...register("publicationYear")} type="number" />
        </div>
        <div className="space-y-1">
          <Label>ISBN</Label>
          <Input {...register("isbn")} />
        </div>
        <div className="space-y-1">
          <Label>Dewey No.</Label>
          <Input {...register("deweyNo")} placeholder="e.g. 005.133" />
        </div>
        <div className="space-y-1">
          <Label>Call Number</Label>
          <Input {...register("callNumber")} />
        </div>
        <div className="space-y-1">
          <Label>Edition</Label>
          <Input {...register("edition")} />
        </div>
        <div className="space-y-1">
          <Label>Language</Label>
          <Input {...register("language")} />
        </div>
        <div className="space-y-1">
          <Label>Price (₹)</Label>
          <Input {...register("price")} type="number" step="0.01" />
        </div>
        <div className="space-y-1">
          <Label>No. of Copies</Label>
          <Input {...register("copies")} type="number" min={1} defaultValue={1} />
        </div>
        <div className="space-y-1">
          <Label>Location / Shelf</Label>
          <Input {...register("location")} placeholder="E.g. CS Section" />
        </div>
        <div className="space-y-1">
          <Label>Shelf No.</Label>
          <Input {...register("shelfNo")} />
        </div>
        <div className="col-span-2 space-y-1">
          <Label>Subjects (semicolon-separated)</Label>
          <Input {...register("subjects")} placeholder="Computer Science; Programming" />
        </div>
        <div className="col-span-2 space-y-1">
          <Label>Abstract</Label>
          <Textarea {...register("abstract")} rows={2} />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Adding..." : "Add Book"}
      </Button>
    </form>
  );
}

export default function CataloguingPage() {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["books", search, type, page],
    queryFn: () => axios.get(`/api/books?q=${search}&type=${type === "all" ? "" : type}&page=${page}`).then((r) => r.data),
    placeholderData: (prev) => prev,
  });

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header title="Cataloguing" />
      <div className="p-6 space-y-4">
        <div className="flex gap-3 items-center flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Search by title, ISBN, accession no..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <Select value={type} onValueChange={(v) => { if (v !== null) setType(v); setPage(1); }}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {MATERIAL_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button />}>
              <Plus className="h-4 w-4 mr-1" /> Add Item
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Add Catalogue Item</DialogTitle></DialogHeader>
              <AddBookForm onSuccess={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["books"] }); }} />
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <p className="text-slate-500 text-sm">Loading...</p>
        ) : (
          <>
            <p className="text-xs text-slate-500">{data?.total ?? 0} items found</p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {(data?.items ?? []).map((item: any) => (
                <Card key={item.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-4 pb-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-semibold text-sm leading-tight line-clamp-2">{item.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{item.authors?.join(", ")}</p>
                      </div>
                      <Badge variant={item.availableCopies > 0 ? "default" : "destructive"} className="shrink-0 text-xs">
                        {item.availableCopies}/{item.totalCopies}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1 text-xs text-slate-500">
                      <span>{item.publisher}</span>
                      {item.publicationYear && <span>· {item.publicationYear}</span>}
                      {item.isbn && <span>· ISBN: {item.isbn}</span>}
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <Badge variant="outline">{item.materialType}</Badge>
                      <span className="text-slate-400">{item.accessionNo}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="flex gap-2 items-center pt-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <span className="text-sm text-slate-500">Page {page}</span>
              <Button variant="outline" size="sm" disabled={data?.items?.length < 20} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
