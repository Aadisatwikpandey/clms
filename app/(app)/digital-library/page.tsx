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
import { CardGridSkeleton } from "@/components/ui/loading-cards";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ExternalLink, Plus, Search, FileText, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { useSession } from "next-auth/react";

const RESOURCE_TYPES = ["article","ebook","video","audio","thesis","report","other"];

function EditResourceForm({ resource, onSuccess }: { resource: any; onSuccess: () => void }) {
  const { register, handleSubmit, formState: { isSubmitting } } = useForm({
    defaultValues: {
      title: resource.title ?? "", resourceType: resource.resourceType ?? "article",
      authors: (resource.authors ?? []).join(", "), source: resource.source ?? "",
      externalUrl: resource.externalUrl ?? "", publicationYear: resource.publicationYear ?? "",
      language: resource.language ?? "English", subjects: (resource.subjects ?? []).join("; "),
      abstract: resource.abstract ?? "",
    }
  });

  async function onSubmit(data: any) {
    await axios.patch(`/api/digital-library/${resource.id}`, {
      ...data,
      authors: data.authors ? data.authors.split(",").map((a: string) => a.trim()) : [],
      subjects: data.subjects ? data.subjects.split(";").map((s: string) => s.trim()) : [],
      publicationYear: data.publicationYear ? parseInt(data.publicationYear) : undefined,
    });
    toast.success("Resource updated");
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1"><Label>Title *</Label><Input {...register("title", { required: true })} /></div>
        <div className="space-y-1"><Label>Type</Label>
          <select className="w-full border rounded px-3 py-2 text-sm" {...register("resourceType")}>
            {RESOURCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="space-y-1"><Label>Authors</Label><Input {...register("authors")} /></div>
        <div className="space-y-1"><Label>Source</Label><Input {...register("source")} /></div>
        <div className="space-y-1"><Label>External URL</Label><Input {...register("externalUrl")} type="url" /></div>
        <div className="space-y-1"><Label>Year</Label><Input {...register("publicationYear")} type="number" /></div>
        <div className="space-y-1"><Label>Language</Label><Input {...register("language")} /></div>
        <div className="col-span-2 space-y-1"><Label>Subjects (semicolon-sep)</Label><Input {...register("subjects")} /></div>
        <div className="col-span-2 space-y-1"><Label>Abstract</Label><Input {...register("abstract")} /></div>
      </div>
      <div className="flex gap-2">
        <DialogClose render={<Button type="button" variant="outline" className="flex-1" />}>Cancel</DialogClose>
        <Button type="submit" className="flex-1" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save Changes"}</Button>
      </div>
    </form>
  );
}

export default function DigitalLibraryPage() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<any>(null);
  const qc = useQueryClient();
  const { data: session } = useSession();
  const role = (session?.user as any)?.role ?? "readonly";
  const canEdit = ["admin", "librarian", "staff"].includes(role);
  const canDelete = ["admin", "librarian"].includes(role);

  const deleteResource = useMutation({
    mutationFn: (id: number) => axios.delete(`/api/digital-library/${id}`),
    onSuccess: () => { toast.success("Resource removed"); qc.invalidateQueries({ queryKey: ["digital-resources"] }); },
    onError: (err: any) => toast.error(err.response?.data?.error ?? "Delete failed"),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["digital-resources", query],
    queryFn: () => axios.get(`/api/digital-library?q=${query}`).then((r) => r.data),
  });

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm({
    defaultValues: { title: "", resourceType: "article", authors: "", source: "", externalUrl: "", subjects: "", language: "English", publicationYear: "", abstract: "" }
  });

  const createResource = useMutation({
    mutationFn: (data: any) => axios.post("/api/digital-library", data).then((r) => r.data),
    onSuccess: () => { toast.success("Resource indexed"); setOpen(false); reset(); qc.invalidateQueries({ queryKey: ["digital-resources"] }); },
    onError: (err: any) => toast.error(err.response?.data?.error ?? "Failed"),
  });

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header title="Digital Library" />
      <div className="p-6 space-y-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input className="pl-9" placeholder="Search digital resources..." value={search} onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setQuery(search)} />
          </div>
          <Button variant="outline" onClick={() => setQuery(search)}>Search</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button />}><Plus className="h-4 w-4 mr-1" /> Index Resource</DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Index Digital Resource</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit((d) => createResource.mutate({ ...d, authors: d.authors ? [d.authors] : [], subjects: d.subjects ? d.subjects.split(";").map((s: string) => s.trim()) : [], publicationYear: d.publicationYear ? parseInt(d.publicationYear) : undefined }))} className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1"><Label>Title *</Label><Input {...register("title", { required: true })} /></div>
                  <div className="space-y-1"><Label>Type</Label>
                    <select className="w-full border rounded px-3 py-2 text-sm" {...register("resourceType")}>
                      {["article","ebook","video","audio","thesis","report","other"].map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1"><Label>Authors</Label><Input {...register("authors")} /></div>
                  <div className="space-y-1"><Label>Source</Label><Input {...register("source")} /></div>
                  <div className="space-y-1"><Label>External URL</Label><Input {...register("externalUrl")} type="url" /></div>
                  <div className="space-y-1"><Label>Year</Label><Input {...register("publicationYear")} type="number" /></div>
                  <div className="space-y-1"><Label>Language</Label><Input {...register("language")} /></div>
                  <div className="col-span-2 space-y-1"><Label>Subjects (semicolon-sep)</Label><Input {...register("subjects")} /></div>
                  <div className="col-span-2 space-y-1"><Label>Abstract</Label><Input {...register("abstract")} /></div>
                </div>
                <div className="flex gap-2">
                  <DialogClose render={<Button type="button" variant="outline" className="flex-1" />}>Cancel</DialogClose>
                  <Button type="submit" className="flex-1" disabled={isSubmitting}>{isSubmitting ? "Indexing..." : "Index Resource"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Dialog open={!!editingResource} onOpenChange={(o) => !o && setEditingResource(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Edit Digital Resource</DialogTitle></DialogHeader>
            {editingResource && (
              <EditResourceForm resource={editingResource} onSuccess={() => { setEditingResource(null); qc.invalidateQueries({ queryKey: ["digital-resources"] }); }} />
            )}
          </DialogContent>
        </Dialog>

        {isLoading ? <CardGridSkeleton count={4} className="grid grid-cols-1 md:grid-cols-2 gap-4" /> : (
          <>
            <p className="text-xs text-slate-500">{data?.total ?? 0} resources</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(data?.resources ?? []).map((r: any) => (
                <Card key={r.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-4 pb-4 space-y-2">
                    <div className="flex items-start gap-2">
                      <FileText className="h-4 w-4 text-[#6D5DFB] mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm line-clamp-2">{r.title}</p>
                        <p className="text-xs text-slate-500">{r.authors?.join(", ")}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex gap-1">
                        <Badge variant="outline" className="text-xs">{r.resourceType}</Badge>
                        {r.language && <Badge variant="secondary" className="text-xs">{r.language}</Badge>}
                      </div>
                      {r.externalUrl && (
                        <a href={r.externalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-xs text-violet-600 hover:underline">
                          <ExternalLink className="h-3 w-3 mr-1" /> Open
                        </a>
                      )}
                    </div>
                    {(canEdit || canDelete) && (
                      <div className="flex items-center justify-end gap-1 pt-1 border-t">
                        {canEdit && (
                          <Button variant="ghost" size="icon-sm" onClick={() => setEditingResource(r)} title="Edit">
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canDelete && (
                          <ConfirmDialog
                            trigger={<Button variant="ghost" size="icon-sm" title="Delete"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>}
                            title="Remove this resource?"
                            description={`"${r.title}" will be removed from the digital library.`}
                            confirmLabel="Delete"
                            onConfirm={() => deleteResource.mutate(r.id)}
                          />
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
