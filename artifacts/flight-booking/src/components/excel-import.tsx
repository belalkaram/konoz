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
import { authFetch, BASE } from "@/lib/api";

interface ImportRow {
  fullName: string;
  phone: string;
  passportNumber: string;
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
  "Customer Name / اسم العميل",
  "Customer Phone / تليفون العميل",
  "Passport No. / رقم الجواز",
  "Travel Destination / وجهة السفر",
  "Travel Date / تاريخ السفر",
  "PNR",
  "Airline / شركة الطيران",
  "Ticket Cost (system) / تكلفة التذكرة على السيستم",
  "Selling Price to Customer / سعر البيع للعميل",
  "Ticket Profit / ربح التذكرة",
  "Payment Method / طريقة السداد",
  "Booking Date / تاريخ الحجز",
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

        // Helper: pick first non-empty value from multiple possible column keys
        function pick(row: Record<string, unknown>, ...keys: string[]): unknown {
          for (const key of keys) {
            const val = row[key];
            if (val !== undefined && val !== null && val !== "") return val;
          }
          // Also try case-insensitive match
          const lowerKeys = keys.map((k) => k.toLowerCase());
          for (const rKey of Object.keys(row)) {
            if (lowerKeys.includes(rKey.toLowerCase())) {
              const val = row[rKey];
              if (val !== undefined && val !== null && val !== "") return val;
            }
          }
          // Also try partial match (for bilingual headers like "Customer Name / اسم العميل")
          for (const key of keys) {
            for (const rKey of Object.keys(row)) {
              if (rKey.includes(key) || key.includes(rKey)) {
                const val = row[rKey];
                if (val !== undefined && val !== null && val !== "") return val;
              }
            }
          }
          return "";
        }

        const parsed: ImportRow[] = raw.map((r) => {
          const costPrice = parseNumber(pick(r,
            "Ticket Cost (system)", "Ticket Cost", "Cost Price", "ticket_cost",
            "تكلفة التذكرة على السيستم", "تكلفة التذكرة", "التكلفة"
          ));
          const sellingPrice = parseNumber(pick(r,
            "Selling Price to Customer", "Selling Price", "selling_price", "Price",
            "سعر البيع للعميل", "سعر البيع", "السعر"
          ));
          const ticketProfit = parseNumber(pick(r,
            "Ticket Profit", "Profit", "profit",
            "ربح التذكرة", "الربح"
          ));
          return {
            fullName: String(pick(r, "Customer Name", "Name", "اسم العميل", "الاسم", "client name", "client")),
            phone: String(pick(r, "Customer Phone", "Phone", "تليفون العميل", "التليفون", "رقم الهاتف", "Mobile", "mobile")),
            passportNumber: String(pick(r, "Passport No.", "Passport No", "Passport Number", "Passport", "passport", "رقم الجواز", "جواز السفر", "رقم جواز السفر", "الجواز")),
            flightRoute: String(pick(r, "Travel Destination", "Destination", "Flight Route", "Route", "وجهة السفر", "الوجهة", "الرحلة")),
            travelDate: parseDate(pick(r, "Travel Date", "Departure Date", "تاريخ السفر", "تاريخ المغادرة", "تاريخ الرحلة")),
            pnr: String(pick(r, "PNR", "pnr", "Booking Reference", "Confirmation Number")),
            airline: String(pick(r, "Airline", "airline", "شركة الطيران", "الطيران", "Carrier")),
            costPrice,
            price: sellingPrice,
            ticketProfit,
            paymentMethod: String(pick(r, "Payment Method", "payment_method", "طريقة السداد", "طريقة الدفع", "Payment")),
            bookingDate: parseDate(pick(r, "Booking Date", "booking_date", "تاريخ الحجز", "تاريخ الحجز / Booking Date")),
          };
        }).filter((r) => r.fullName.trim() !== "");

        if (parsed.length === 0) {
          setParseError('No valid rows found. Make sure "Customer Name" or "اسم العميل" column is filled.');
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
        passportNumber: r.passportNumber || undefined,
        flightRoute: r.flightRoute || undefined,
        travelDate: r.travelDate || undefined,
        pnr: r.pnr || undefined,
        airline: r.airline || undefined,
        costPrice: r.costPrice ?? undefined,
        price: r.price ?? undefined,
        paymentMethod: r.paymentMethod || undefined,
        bookingDate: r.bookingDate || undefined,
      }));

      const res = await authFetch(`${BASE}/api/customers/import`, {
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
