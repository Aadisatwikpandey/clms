"use client";
import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, CheckCircle, AlertTriangle, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

export default function MigrationPage() {
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState("books");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setResult(null);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", type);

    try {
      const res = await axios.post("/api/migration", fd);
      setResult(res.data);
      toast.success(`Import complete: ${res.data.imported} records imported`);
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Import failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header title="Data Migration" />
      <div className="p-6 space-y-6 max-w-2xl">
        <Card>
          <CardHeader><CardTitle>Import from CSV/Excel</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Import Type</label>
                <Select value={type} onValueChange={(v) => { if (v !== null) setType(v); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="books">Books / Catalogue Items</SelectItem>
                    <SelectItem value="members">Members</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <FileSpreadsheet className="h-10 w-10 mx-auto text-slate-400 mb-2" />
                <p className="text-sm text-slate-600 mb-2">
                  {file ? file.name : "Drop CSV file here or click to select"}
                </p>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  id="file-input"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById("file-input")?.click()}>
                  Select File
                </Button>
              </div>

              <div className="bg-slate-50 rounded p-3 text-xs text-slate-600 space-y-1">
                <p className="font-semibold">Required CSV columns for {type}:</p>
                {type === "books" ? (
                  <p>title, authors, publisher, year, isbn, dewey_no, call_no, language, price, location, copies</p>
                ) : (
                  <p>name, type (student/faculty/staff/external), department, course, roll_no, email, phone, membership_no</p>
                )}
              </div>

              <Button type="submit" disabled={!file || loading} className="w-full">
                <Upload className="h-4 w-4 mr-2" />
                {loading ? "Importing..." : "Start Import"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Import Results</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div><p className="text-2xl font-bold">{result.total}</p><p className="text-xs text-slate-500">Total Rows</p></div>
                <div><p className="text-2xl font-bold text-green-600">{result.imported}</p><p className="text-xs text-slate-500">Imported</p></div>
                <div><p className="text-2xl font-bold text-red-600">{result.failed}</p><p className="text-xs text-slate-500">Failed</p></div>
              </div>
              {result.failures?.length > 0 && (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {result.failures.map((f: any, i: number) => (
                    <Alert key={i} variant="destructive" className="py-2">
                      <AlertTriangle className="h-3 w-3" />
                      <AlertDescription className="text-xs">{f.error}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
