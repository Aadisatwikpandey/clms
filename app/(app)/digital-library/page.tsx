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
import { ExternalLink, Plus, Search, FileText } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";

export default function DigitalLibraryPage() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

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
                <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? "Indexing..." : "Index Resource"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? <p className="text-slate-500 text-sm">Loading...</p> : (
          <>
            <p className="text-xs text-slate-500">{data?.total ?? 0} resources</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(data?.resources ?? []).map((r: any) => (
                <Card key={r.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-4 pb-4 space-y-2">
                    <div className="flex items-start gap-2">
                      <FileText className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
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
                        <a href={r.externalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-xs text-blue-600 hover:underline">
                          <ExternalLink className="h-3 w-3 mr-1" /> Open
                        </a>
                      )}
                    </div>
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
