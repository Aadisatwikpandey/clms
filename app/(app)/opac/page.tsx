"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { BookOpen, Search, BookMarked, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";

function MyReservationsPanel() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["my-reservations"],
    queryFn: () => axios.get("/api/circulation/reservations").then((r) => r.data),
  });

  const cancelMutation = useMutation({
    mutationFn: (reservationId: number) => axios.patch("/api/circulation/reservations", { reservationId, action: "cancel" }).then((r) => r.data),
    onSuccess: () => { toast.success("Reservation cancelled"); qc.invalidateQueries({ queryKey: ["my-reservations"] }); },
    onError: (err: any) => toast.error(err.response?.data?.error ?? "Cancel failed"),
  });

  if (!data || data.length === 0) return null;

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">My Reservations ({data.length})</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {data.map((r: any) => (
          <div key={r.id} className="flex items-center justify-between p-2 border rounded text-sm">
            <div>
              <p className="font-medium">{r.title}</p>
              <p className="text-xs text-slate-500">Reserved {new Date(r.reservedAt).toLocaleDateString()}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={r.availableCopies > 0 ? "default" : "secondary"} className="text-xs">
                {r.availableCopies > 0 ? "Ready for pickup" : "Waiting"}
              </Badge>
              <Button size="sm" variant="ghost" onClick={() => cancelMutation.mutate(r.id)}>Cancel</Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function OPACPage() {
  const { data: session } = useSession();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [language, setLanguage] = useState("");
  const [available, setAvailable] = useState(false);
  const [from, setFrom] = useState(0);
  const isMember = !!session && !!(session.user as any).memberId;

  const { data, isFetching } = useQuery({
    queryKey: ["opac-search", search, type, language, available, from],
    queryFn: () => axios.get(`/api/search?q=${search}&type=${type === "all" ? "" : type}&lang=${language}&available=${available}&from=${from}&size=20`).then((r) => r.data),
    enabled: !!search || from > 0,
    placeholderData: (prev) => prev,
  });

  const reserveMutation = useMutation({
    mutationFn: (catalogueItemId: number) => axios.post("/api/circulation/reserve", { catalogueItemId }).then((r) => r.data),
    onSuccess: () => toast.success("Reservation placed successfully"),
    onError: (err: any) => toast.error(err.response?.data?.error ?? "Reservation failed"),
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(query);
    setFrom(0);
  }

  const aggs = data?.aggregations;
  const hits = data?.hits ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header title="OPAC – Online Public Access Catalogue" />
      <div className="p-6 space-y-4">
        {isMember && <MyReservationsPanel />}

        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              className="pl-9 text-base"
              placeholder="Search by title, author, subject, ISBN, keyword..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Select value={type} onValueChange={(v) => { if (v !== null) setType(v); }}>
            <SelectTrigger className="w-36"><SelectValue placeholder="All types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {["book","journal","magazine","thesis","digital"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button type="button" variant={available ? "default" : "outline"} onClick={() => setAvailable(!available)}>
            {available ? "Available Only ✓" : "Available Only"}
          </Button>
          <Button type="submit">Search</Button>
        </form>

        {data && (
          <div className="flex gap-6">
            {/* Facets */}
            {aggs && (
              <div className="w-48 shrink-0 space-y-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Material Type</p>
                  {(aggs.materialType?.buckets ?? []).map((b: any) => (
                    <button key={b.key} onClick={() => setType(b.key === type ? "all" : b.key)} className="flex justify-between w-full text-xs py-0.5 hover:text-violet-600">
                      <span className={b.key === type ? "text-violet-600 font-medium" : ""}>{b.key}</span>
                      <span className="text-slate-400">{b.doc_count}</span>
                    </button>
                  ))}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Language</p>
                  {(aggs.language?.buckets ?? []).map((b: any) => (
                    <button key={b.key} onClick={() => setLanguage(b.key === language ? "" : b.key)} className="flex justify-between w-full text-xs py-0.5 hover:text-violet-600">
                      <span className={b.key === language ? "text-violet-600 font-medium" : ""}>{b.key}</span>
                      <span className="text-slate-400">{b.doc_count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Results */}
            <div className="flex-1 space-y-3">
              <p className="text-sm text-slate-500">
                {isFetching ? "Searching..." : `${total} result(s) found`}
              </p>
              {hits.map((item: any, i: number) => (
                <Card key={i} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-1">
                        <p className="font-semibold text-sm leading-snug">
                          {item.highlight?.title ? (
                            <span dangerouslySetInnerHTML={{ __html: item.highlight.title[0] }} />
                          ) : item.title}
                        </p>
                        <p className="text-xs text-slate-500">{Array.isArray(item.authors) ? item.authors.join(", ") : item.authors}</p>
                        <div className="flex flex-wrap gap-1 text-xs text-slate-400">
                          {item.publisher && <span>{item.publisher}</span>}
                          {item.publicationYear && <span>· {item.publicationYear}</span>}
                          {item.isbn && <span>· ISBN: {item.isbn}</span>}
                          {item.deweyNo && <span>· {item.deweyNo}</span>}
                        </div>
                        {item.abstract && <p className="text-xs text-slate-500 line-clamp-2 mt-1">{item.abstract}</p>}
                        <div className="flex flex-wrap gap-1 mt-1">
                          <Badge variant="outline" className="text-xs">{item.materialType}</Badge>
                          {item.location && <Badge variant="secondary" className="text-xs">{item.location}</Badge>}
                        </div>
                      </div>
                      <div className="text-right shrink-0 space-y-2">
                        <Badge variant={item.availableCopies > 0 ? "default" : "destructive"}>
                          {item.availableCopies}/{item.totalCopies} available
                        </Badge>
                        {isMember && item.availableCopies === 0 && (
                          <div>
                            <ConfirmDialog
                              trigger={<Button size="sm" variant="outline"><BookMarked className="h-3 w-3 mr-1" /> Reserve</Button>}
                              title="Reserve this title?"
                              description={`"${item.title}" is currently unavailable. You'll be notified when a copy is ready — this hold lasts 7 days. You can cancel it anytime from "My Reservations" above.`}
                              confirmLabel="Reserve"
                              destructive={false}
                              onConfirm={() => reserveMutation.mutate(item.id)}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <div className="flex gap-2 items-center">
                <Button variant="outline" size="sm" disabled={from === 0} onClick={() => setFrom(Math.max(0, from - 20))}>Previous</Button>
                <span className="text-sm text-slate-500">Showing {from + 1}–{Math.min(from + 20, total)}</span>
                <Button variant="outline" size="sm" disabled={from + 20 >= total} onClick={() => setFrom(from + 20)}>Next</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
