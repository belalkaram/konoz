import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Users, Plus, Search, ChevronRight, Phone, FileSpreadsheet, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { formatShortDate } from "@/lib/formatters";
import { CustomerForm, EMPTY_CUSTOMER_FORM } from "@/components/customer-form";
import { ExcelImportDialog } from "@/components/excel-import";
import { STATUS_COLORS, STATUS_LABELS, CUSTOMER_STATUSES } from "@/lib/customer-constants";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Customer {
  id: number;
  fullName: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  nationality: string | null;
  passportNumber: string | null;
  nationalId: string | null;
  address: string | null;
  source: string | null;
  status: string;
  assignedEmployeeId: number | null;
  lastContactedAt: string | null;
  createdAt: string;
  updatedAt: string;
  pnr: string | null;
  bookingDate: string | null;
  costPrice: string | null;
  sellingPrice: string | null;
  ticketCurrency: string | null;
}

async function fetchCustomers(): Promise<{ customers: Customer[] }> {
  const res = await fetch(`${BASE}/api/customers`);
  if (!res.ok) throw new Error("Failed to fetch customers");
  return res.json();
}

async function createCustomer(data: Record<string, unknown>): Promise<{ customer: Customer }> {
  const res = await fetch(`${BASE}/api/customers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to create customer");
  return json;
}

function netProfit(c: Customer): number | null {
  const sell = c.sellingPrice != null ? parseFloat(c.sellingPrice) : null;
  const cost = c.costPrice != null ? parseFloat(c.costPrice) : null;
  if (sell == null || cost == null) return sell != null ? sell : null;
  return sell - cost;
}

export function CustomerFormSheet({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: (data) => {
      toast({ title: "Customer added", description: `${data.customer.fullName} has been added.` });
      qc.invalidateQueries({ queryKey: ["customers"] });
      onSuccess();
      onClose();
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Add New Customer</SheetTitle>
        </SheetHeader>
        <CustomerForm
          initialValues={EMPTY_CUSTOMER_FORM}
          submitLabel="Add Customer"
          isPending={mutation.isPending}
          onSubmit={(data) => mutation.mutate(data)}
          onCancel={onClose}
        />
      </SheetContent>
    </Sheet>
  );
}

export default function Customers() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["customers"],
    queryFn: fetchCustomers,
    staleTime: 30_000,
  });

  const allCustomers = data?.customers ?? [];

  const customers = allCustomers.filter((c) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      c.fullName.toLowerCase().includes(q) ||
      (c.phone ?? "").toLowerCase().includes(q) ||
      (c.pnr ?? "").toLowerCase().includes(q) ||
      (c.passportNumber ?? "").toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage all your customer bookings and travel records.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-2"
          >
            <FileSpreadsheet className="h-4 w-4 text-green-600" />
            Import from Excel
          </Button>
          <Button onClick={() => setAddOpen(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add Customer
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search by name, phone, PNR, or passport..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {CUSTOMER_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading && (
            <div>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-3 border-b last:border-0">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-6 w-16 rounded-full ml-auto" />
                </div>
              ))}
            </div>
          )}

          {isError && (
            <div className="text-center py-12 text-destructive">Failed to load customers.</div>
          )}

          {!isLoading && !isError && customers.length === 0 && (
            <div className="flex flex-col items-center py-16 text-center">
              <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground font-medium">No customers found</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                {search || statusFilter !== "all"
                  ? "Try adjusting your search or filters."
                  : "Add your first customer or import from Excel."}
              </p>
            </div>
          )}

          {!isLoading && customers.length > 0 && (
            <>
              <div className="hidden md:grid grid-cols-[2fr_1.3fr_0.7fr_0.9fr_0.9fr_1fr_0.9fr_auto] gap-3 px-6 py-2 border-b bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <span>Name</span>
                <span>Phone</span>
                <span>Status</span>
                <span>Passport No.</span>
                <span>PNR</span>
                <span>Booking Date</span>
                <span>Net Profit (KWD)</span>
                <span className="w-4" />
              </div>

              <div className="divide-y">
                {customers.map((c) => {
                  const profit = netProfit(c);
                  return (
                    <Link key={c.id} href={`/customers/${c.id}`}>
                      <div className="grid md:grid-cols-[2fr_1.3fr_0.7fr_0.9fr_0.9fr_1fr_0.9fr_auto] grid-cols-1 gap-2 md:gap-3 px-6 py-3.5 hover:bg-muted/30 transition-colors cursor-pointer group items-center">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                            style={{ background: "linear-gradient(135deg, #d4af37 0%, #f5d76e 50%, #d4af37 100%)", color: "#022c22" }}>
                            {c.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold truncate group-hover:text-primary transition-colors text-sm">{c.fullName}</div>
                          </div>
                        </div>

                        <div className="hidden md:block min-w-0">
                          {c.phone && (
                            <div className="flex items-center gap-1 text-sm truncate">
                              <Phone className="h-3 w-3 flex-shrink-0 text-muted-foreground" /> {c.phone}
                            </div>
                          )}
                        </div>

                        <div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status] ?? "bg-gray-100 text-gray-600"}`}>
                            {STATUS_LABELS[c.status] ?? c.status}
                          </span>
                        </div>

                        <div className="hidden md:block text-sm text-muted-foreground font-mono">
                          {c.passportNumber || "—"}
                        </div>

                        <div className="hidden md:block text-sm font-mono font-medium">
                          {c.pnr || "—"}
                        </div>

                        <div className="hidden md:block text-sm text-muted-foreground">
                          {c.bookingDate ? formatShortDate(c.bookingDate) : "—"}
                        </div>

                        <div className="hidden md:flex items-center gap-1">
                          {profit != null ? (
                            <>
                              {profit >= 0 ? (
                                <TrendingUp className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                              ) : (
                                <TrendingDown className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                              )}
                              <span className={`text-sm font-semibold ${profit >= 0 ? "text-green-600" : "text-red-500"}`}>
                                {profit.toFixed(3)}
                              </span>
                            </>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </div>

                        <div className="hidden md:flex justify-end">
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>

              <div className="px-6 py-3 border-t text-xs text-muted-foreground flex items-center gap-3">
                <span>{customers.length} customer{customers.length !== 1 ? "s" : ""}</span>
                {customers.length !== allCustomers.length && (
                  <span className="text-muted-foreground/70">(filtered from {allCustomers.length})</span>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <CustomerFormSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSuccess={() => {}}
      />

      <ExcelImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={() => qc.invalidateQueries({ queryKey: ["customers"] })}
      />
    </div>
  );
}
