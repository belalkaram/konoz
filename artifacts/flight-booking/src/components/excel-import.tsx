import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ImportRow {
  fullName: string;
  phone: string;
  flightRoute: string;
  travelDate: string;
  pnr: string;
  airline: string;
  costPrice: number | null;
  price: number | null;
  ticketProfit: number | null;
  paymentMethod: string;
  bookingDate: string;
}

type ImportResult = { customerName: string; success: boolean; error?: string };

function parseNumber(val: unknown): number | null {
  if (val == null || val === "") return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

function parseDate(val: unknown): string {
  if (val == null || val === "") return "";
  if (typeof val === "number") {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  return String(val);
}

const EXPECTED_HEADERS = [
  "Customer Name",
  "Customer Phone",
  "Travel Destination",
  "Travel Date",
  "PNR",
  "Airline",
  "Ticket Cost (system)",
  "Selling Price to Customer",
  "Ticket Profit",
  "Payment Method",
  "Booking Date",
];

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ExcelImportDialog({ open, onClose, onSuccess }: Props) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [parseError, setParseError] = useState("");

  function reset() {
    setRows([]);
    setFileName("");
    setResults(null);
    setParseError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setParseError("");
    setResults(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]!]!;
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

        if (raw.length === 0) {
          setParseError("The sheet appears to be empty.");
          return;
        }

        const parsed: ImportRow[] = raw.map((r) => {
          const costPrice = parseNumber(
            r["Ticket Cost (system)"] ?? r["Ticket Cost"] ?? r["Cost Price"] ?? r["ticket_cost"]
          );
          const sellingPrice = parseNumber(
            r["Selling Price to Customer"] ?? r["Selling Price"] ?? r["selling_price"]
          );
          const ticketProfit = parseNumber(
            r["Ticket Profit"] ?? r["Profit"] ?? r["profit"]
          );
          return {
            fullName: String(r["Customer Name"] ?? r["Name"] ?? ""),
            phone: String(r["Customer Phone"] ?? r["Phone"] ?? ""),
            flightRoute: String(r["Travel Destination"] ?? r["Destination"] ?? ""),
            travelDate: parseDate(r["Travel Date"] ?? r["Departure Date"] ?? ""),
            pnr: String(r["PNR"] ?? r["pnr"] ?? ""),
            airline: String(r["Airline"] ?? r["airline"] ?? ""),
            costPrice,
            price: sellingPrice,
            ticketProfit,
            paymentMethod: String(r["Payment Method"] ?? r["payment_method"] ?? ""),
            bookingDate: parseDate(r["Booking Date"] ?? r["booking_date"] ?? ""),
          };
        }).filter((r) => r.fullName.trim() !== "");

        if (parsed.length === 0) {
          setParseError('No valid rows found. Make sure "Customer Name" column is filled.');
          return;
        }
        setRows(parsed);
      } catch (err) {
        setParseError("Failed to parse the file. Make sure it is a valid Excel (.xlsx/.xls) file.");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleImport() {
    if (rows.length === 0) return;
    setImporting(true);
    try {
      const payload = rows.map((r) => ({
        fullName: r.fullName,
        phone: r.phone || undefined,
        flightRoute: r.flightRoute || undefined,
        travelDate: r.travelDate || undefined,
        pnr: r.pnr || undefined,
        airline: r.airline || undefined,
        costPrice: r.costPrice ?? undefined,
        price: r.price ?? undefined,
        paymentMethod: r.paymentMethod || undefined,
        bookingDate: r.bookingDate || undefined,
      }));

      const res = await fetch(`${BASE}/api/customers/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Import failed");

      setResults(json.results);
      toast({
        title: "Import complete",
        description: `${json.succeeded} of ${json.total} rows imported successfully.`,
      });
      onSuccess();
    } catch (err: unknown) {
      toast({
        title: "Import failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  }

  const succeeded = results?.filter((r) => r.success).length ?? 0;
  const failed = results?.filter((r) => !r.success).length ?? 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-green-600" />
            Import Employee Data from Excel
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {!results && (
            <>
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="font-medium text-sm">Click to choose an Excel file</p>
                <p className="text-xs text-muted-foreground mt-1">Supports .xlsx and .xls files</p>
                {fileName && (
                  <p className="text-xs text-primary font-medium mt-2">{fileName}</p>
                )}
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFile}
              />

              {parseError && (
                <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-md px-3 py-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {parseError}
                </div>
              )}

              {rows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{rows.length} rows ready to import</p>
                    <Button variant="ghost" size="sm" onClick={reset}>Clear</Button>
                  </div>

                  <p className="text-xs text-muted-foreground">Expected columns (flexible header names accepted):</p>
                  <div className="flex flex-wrap gap-1">
                    {EXPECTED_HEADERS.map((h) => (
                      <span key={h} className="text-xs bg-muted px-2 py-0.5 rounded">{h}</span>
                    ))}
                  </div>

                  <div className="border rounded-md overflow-x-auto mt-2">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left px-3 py-2 font-semibold">Name</th>
                          <th className="text-left px-3 py-2 font-semibold">Phone</th>
                          <th className="text-left px-3 py-2 font-semibold">Destination</th>
                          <th className="text-left px-3 py-2 font-semibold">PNR</th>
                          <th className="text-left px-3 py-2 font-semibold">Airline</th>
                          <th className="text-right px-3 py-2 font-semibold">Cost (KWD)</th>
                          <th className="text-right px-3 py-2 font-semibold">Sell (KWD)</th>
                          <th className="text-right px-3 py-2 font-semibold">Profit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {rows.slice(0, 20).map((r, i) => {
                          const profit = r.ticketProfit ?? ((r.price != null && r.costPrice != null) ? r.price - r.costPrice : null);
                          return (
                            <tr key={i} className="hover:bg-muted/20">
                              <td className="px-3 py-1.5 max-w-[120px] truncate">{r.fullName}</td>
                              <td className="px-3 py-1.5 text-muted-foreground">{r.phone || "—"}</td>
                              <td className="px-3 py-1.5 text-muted-foreground max-w-[100px] truncate">{r.flightRoute || "—"}</td>
                              <td className="px-3 py-1.5 font-mono text-xs">{r.pnr || "—"}</td>
                              <td className="px-3 py-1.5 text-muted-foreground">{r.airline || "—"}</td>
                              <td className="px-3 py-1.5 text-right">{r.costPrice != null ? r.costPrice.toFixed(3) : "—"}</td>
                              <td className="px-3 py-1.5 text-right">{r.price != null ? r.price.toFixed(3) : "—"}</td>
                              <td className={`px-3 py-1.5 text-right font-medium ${profit != null && profit >= 0 ? "text-green-600" : "text-red-500"}`}>
                                {profit != null ? profit.toFixed(3) : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {rows.length > 20 && (
                      <p className="text-xs text-muted-foreground text-center py-2 border-t">
                        Showing first 20 of {rows.length} rows
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {results && (
            <div className="space-y-3">
              <div className="flex gap-4">
                <div className="flex items-center gap-2 text-green-600 font-medium">
                  <CheckCircle className="h-5 w-5" />
                  {succeeded} imported
                </div>
                {failed > 0 && (
                  <div className="flex items-center gap-2 text-red-500 font-medium">
                    <XCircle className="h-5 w-5" />
                    {failed} failed
                  </div>
                )}
              </div>

              {failed > 0 && (
                <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
                  {results.filter((r) => !r.success).map((r, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 text-xs text-red-600">
                      <XCircle className="h-3 w-3 flex-shrink-0" />
                      <span className="font-medium">{r.customerName}</span>
                      <span className="text-muted-foreground">— {r.error}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          {!results ? (
            <>
              <Button variant="outline" onClick={handleClose} disabled={importing}>Cancel</Button>
              <Button
                onClick={handleImport}
                disabled={rows.length === 0 || importing}
                className="gap-2"
              >
                {importing ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Importing...</>
                ) : (
                  <><Upload className="h-4 w-4" /> Import {rows.length > 0 ? `${rows.length} rows` : ""}</>
                )}
              </Button>
            </>
          ) : (
            <Button onClick={handleClose}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
