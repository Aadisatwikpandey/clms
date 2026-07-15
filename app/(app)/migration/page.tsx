"use client";
import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Upload, CheckCircle, AlertTriangle, FileSpreadsheet, Eye } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import Papa from "papaparse";

const IMPORT_TYPES: { value: string; label: string; note?: string }[] = [
  { value: "books", label: "Books / Catalogue Items" },
  { value: "members", label: "Members" },
  { value: "circulation", label: "Circulation History (issue/return)", note: "Requires members and books/copies to already exist." },
  { value: "vendors", label: "Vendors" },
  { value: "purchase-orders", label: "Purchase Orders", note: "Requires vendors to already exist — import vendors first." },
  { value: "serials", label: "Serials & Issues" },
  { value: "gate-visits", label: "Gate Visit Logs (entry/exit)", note: "Requires members to already exist." },
  { value: "digital-library", label: "Digital Library Resources" },
  { value: "reservations", label: "Reservations", note: "Requires members and books to already exist." },
];

const REQUIRED_COLUMNS: Record<string, string[]> = {
  books: ["title", "authors", "publisher", "year", "isbn", "dewey_no", "call_no", "language", "price", "location", "copies"],
  members: ["name", "type", "department", "course", "roll_no", "email", "phone", "membership_no"],
  circulation: ["member_barcode", "copy_barcode", "issue_date", "due_date", "return_date"],
  vendors: ["name", "code", "contact_person", "email", "phone", "city", "gst_no"],
  "purchase-orders": ["vendor_name", "budget_head_code", "order_date", "expected_delivery", "status", "item_title", "quantity", "unit_price", "discount"],
  serials: ["serial_title", "issn", "publisher", "frequency", "volume", "issue_no", "expected_date", "received_date", "status"],
  "gate-visits": ["member_barcode", "entry_time", "exit_time"],
  "digital-library": ["title", "resource_type", "authors", "source", "external_url", "subjects", "language", "year", "abstract", "is_public"],
  reservations: ["member_barcode", "accession_no", "reserved_at", "status"],
};

export default function MigrationPage() {
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState("books");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [preview, setPreview] = useState<{ rows: Record<string, string>[]; total: number; columns: string[] } | null>(null);
  const [parsing, setParsing] = useState(false);

  function resetSelection() {
    setFile(null);
    setPreview(null);
    setResult(null);
  }

  function handleFileChange(f: File | null) {
    setFile(f);
    setPreview(null);
    setResult(null);
  }

  function handlePreview() {
    if (!file) return;
    setParsing(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const rows = res.data as Record<string, string>[];
        setPreview({ rows: rows.slice(0, 10), total: rows.length, columns: res.meta.fields ?? [] });
        setParsing(false);
      },
      error: () => {
        toast.error("Could not parse this file as CSV — check the format and try again");
        setParsing(false);
      },
    });
  }

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    setResult(null);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", type);

    try {
      const res = await axios.post("/api/migration", fd);
      setResult(res.data);
      setPreview(null);
      toast.success(`Import complete: ${res.data.imported} records imported`);
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Import failed");
    } finally {
      setLoading(false);
    }
  }

  const missingColumns = preview ? REQUIRED_COLUMNS[type].filter((c) => !preview.columns.includes(c)) : [];

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header title="Data Migration" />
      <div className="p-6 space-y-6 max-w-2xl">
        <Card>
          <CardHeader><CardTitle>Import from CSV</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Import Type</label>
                <Select value={type} onValueChange={(v) => { if (v !== null) { setType(v); resetSelection(); } }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {IMPORT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {IMPORT_TYPES.find((t) => t.value === type)?.note && (
                  <p className="text-xs text-amber-600">{IMPORT_TYPES.find((t) => t.value === type)?.note}</p>
                )}
              </div>

              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <FileSpreadsheet className="h-10 w-10 mx-auto text-slate-400 mb-2" />
                <p className="text-sm text-slate-600 mb-2">
                  {file ? file.name : "Drop CSV file here or click to select"}
                </p>
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  id="file-input"
                  onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                />
                <div className="flex justify-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById("file-input")?.click()}>
                    Select File
                  </Button>
                  {file && (
                    <Button type="button" variant="ghost" size="sm" onClick={resetSelection}>
                      Clear
                    </Button>
                  )}
                </div>
              </div>

              <div className="bg-slate-50 rounded p-3 text-xs text-slate-600 space-y-1">
                <p className="font-semibold">Required CSV columns for {type}:</p>
                <p>{REQUIRED_COLUMNS[type].join(", ")}</p>
              </div>

              {!preview && (
                <Button type="button" onClick={handlePreview} disabled={!file || parsing} className="w-full">
                  <Eye className="h-4 w-4 mr-2" />
                  {parsing ? "Reading file..." : "Preview Before Import"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {preview && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Preview — {preview.total} row(s) detected</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {missingColumns.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Missing expected column(s): {missingColumns.join(", ")}. Rows may import with blank fields — check your CSV headers before continuing.
                  </AlertDescription>
                </Alert>
              )}
              <div className="overflow-x-auto border rounded">
                <table className="text-xs w-full">
                  <thead className="bg-slate-50">
                    <tr>{preview.columns.map((c) => <th key={c} className="text-left p-1.5 font-medium whitespace-nowrap">{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, i) => (
                      <tr key={i} className="border-t">
                        {preview.columns.map((c) => <td key={c} className="p-1.5 whitespace-nowrap max-w-40 truncate">{row[c]}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.total > 10 && <p className="text-xs text-slate-500">Showing first 10 of {preview.total} rows.</p>}

              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setPreview(null)}>
                  Back
                </Button>
                <ConfirmDialog
                  trigger={
                    <Button className="flex-1" disabled={loading}>
                      <Upload className="h-4 w-4 mr-2" />
                      {loading ? "Importing..." : `Import ${preview.total} Row(s)`}
                    </Button>
                  }
                  title={`Import ${preview.total} ${IMPORT_TYPES.find((t) => t.value === type)?.label} record(s)?`}
                  description="This creates new records in the live database for every row shown above. This is a bulk operation and cannot be undone from this screen — review the preview carefully first."
                  confirmLabel="Yes, Import"
                  destructive={missingColumns.length > 0}
                  onConfirm={handleUpload}
                />
              </div>
            </CardContent>
          </Card>
        )}

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
