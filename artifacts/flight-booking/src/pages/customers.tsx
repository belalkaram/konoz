import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Users, Plus, Search, ChevronRight, Phone, FileSpreadsheet, TrendingUp, TrendingDown, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Download } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { formatShortDate, calculateDaysRemaining } from "@/lib/formatters";
import { CustomerForm, EMPTY_CUSTOMER_FORM } from "@/components/customer-form";
import { ExcelImportDialog } from "@/components/excel-import";
import { STATUS_COLORS, STATUS_LABELS, CUSTOMER_STATUSES } from "@/lib/customer-constants";
import { authFetch, BASE } from "@/lib/api";
import { useCurrentEmployee } from "@/contexts/employee-context";
import { useLanguage } from "@/contexts/language-context";
import { cn } from "@/lib/utils";

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
  travelDate: string | null;
  costPrice: string | null;
  sellingPrice: string | null;
  ticketCurrency: string | null;
  uploadedByName?: string | null;
}

async function fetchCustomers(assignedEmployeeId?: string | null): Promise<{ customers: Customer[] }> {
  const url = assignedEmployeeId 
    ? `${BASE}/api/customers?assignedEmployeeId=${assignedEmployeeId}` 
    : `${BASE}/api/customers`;
  const res = await authFetch(url);
  if (!res.ok) throw new Error("Failed to fetch customers");
  return res.json();
}

async function createCustomer(data: Record<string, unknown>): Promise<{ customer: Customer }> {
  const res = await authFetch(`${BASE}/api/customers`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to create customer");
  return json;
}

async function deleteCustomer(id: number): Promise<{ success?: boolean; error?: string; message?: string }> {
  const res = await authFetch(`${BASE}/api/customers/${id}`, { method: "DELETE" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { error: "failed", message: (json as { message?: string }).message || "Failed to delete" };
  return { success: true };
}

function netProfit(c: Customer): number | null {
  const sell = c.sellingPrice != null ? parseFloat(c.sellingPrice) : null;
  const cost = c.costPrice != null ? parseFloat(c.costPrice) : null;
  if (sell == null || cost == null) return null;
  return sell - cost;
}

function formatDaysLeft(label: string, days: number | null, language: string) {
  if (language !== "ar") return label;
  if (!label || label === "—") return "—";
  if (label === "Departed") return "غادرت";
  if (label === "Travels Today") return "يسافر اليوم";
  if (label === "1 Day Left") return "متبقي يوم واحد";
  if (days != null) {
    const absDays = Math.abs(days);
    if (absDays === 2) return "متبقي يومان";
    if (absDays >= 3 && absDays <= 10) return `متبقي ${absDays} أيام`;
    return `متبقي ${absDays} يوم`;
  }
  return label;
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
  const { t, language } = useLanguage();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: (data) => {
      toast({ 
        title: language === "ar" ? "تم إضافة العميل" : "Customer added", 
        description: language === "ar" ? `تم إضافة المسافر ${data.customer.fullName} بنجاح.` : `${data.customer.fullName} has been added.` 
      });
      qc.invalidateQueries({ queryKey: ["customers"] });
      onSuccess();
      onClose();
    },
    onError: (e: Error) => {
      toast({ title: language === "ar" ? "خطأ" : "Error", description: e.message, variant: "destructive" });
    },
  });

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("customers.dialogs.addTitle")}</SheetTitle>
        </SheetHeader>
        <CustomerForm
          initialValues={EMPTY_CUSTOMER_FORM}
          submitLabel={t("customers.addBtn")}
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
  const [sortBy, setSortBy] = useState<"name" | "bookingDate" | "netProfit" | "createdAt">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t, language, isRtl } = useLanguage();
  const currentEmployee = useCurrentEmployee();
  const isAdmin = currentEmployee.role === "Administrator";

  const searchParams = new URLSearchParams(window.location.search);
  const employeeIdParam = searchParams.get("assignedEmployeeId");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["customers", employeeIdParam],
    queryFn: () => fetchCustomers(employeeIdParam),
    staleTime: 5_000,
  });

  const allCustomers = data?.customers ?? [];

  function exportToExcel() {
    const headers = [
      "ID", "Full Name", "Phone", "Email", "Status", "PNR", 
      "Booking Date", "Travel Date", "Cost Price", "Selling Price", "Net Profit", "Currency"
    ];
    const rows = customers.map(c => {
      const formatDateSafe = (d: string | null) => {
        if (!d) return "";
        try {
          const date = new Date(d);
          if (isNaN(date.getTime())) return d; // Fallback to raw string if invalid
          return formatShortDate(d);
        } catch {
          return d;
        }
      };

      const escape = (val: any) => {
        const s = val === null || val === undefined ? "" : String(val);
        return `"${s.replace(/"/g, '""')}"`;
      };

      return [
        escape(c.id),
        escape(c.fullName),
        escape(c.email),
        escape(c.status),
        escape(c.pnr),
        escape(formatDateSafe(c.bookingDate)),
        escape(formatDateSafe(c.travelDate)),
        escape(c.costPrice || "0"),
        escape(c.sellingPrice || "0"),
        escape((netProfit(c) ?? 0).toFixed(3)),
        escape(c.ticketCurrency)
      ];
    });
    
    const csvContent = "\uFEFF" + [headers.map(h => `"${h}"`), ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `customers_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir(col === "name" ? "asc" : "desc");
    }
  }

  function SortIcon({ col }: { col: typeof sortBy }) {
    if (sortBy !== col) return <ArrowUpDown className={cn("h-3 w-3 opacity-40 inline", isRtl ? "mr-1" : "ml-1")} />;
    return sortDir === "asc"
      ? <ArrowUp className={cn("h-3 w-3 text-primary inline", isRtl ? "mr-1" : "ml-1")} />
      : <ArrowDown className={cn("h-3 w-3 text-primary inline", isRtl ? "mr-1" : "ml-1")} />;
  }

  const customers = allCustomers
    .filter((c) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        c.fullName.toLowerCase().includes(q) ||
        (c.phone ?? "").toLowerCase().includes(q) ||
        (c.pnr ?? "").toLowerCase().includes(q) ||
        (c.passportNumber ?? "").toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortBy === "name") {
        cmp = a.fullName.localeCompare(b.fullName);
      } else if (sortBy === "bookingDate") {
        const da = a.bookingDate ? new Date(a.bookingDate).getTime() : 0;
        const db = b.bookingDate ? new Date(b.bookingDate).getTime() : 0;
        cmp = (isNaN(da) ? 0 : da) - (isNaN(db) ? 0 : db);
      } else if (sortBy === "netProfit") {
        const pa = netProfit(a) ?? -Infinity;
        const pb = netProfit(b) ?? -Infinity;
        cmp = pa - pb;
      } else {
        const da = new Date(a.createdAt).getTime();
        const db = new Date(b.createdAt).getTime();
        cmp = (isNaN(da) ? 0 : da) - (isNaN(db) ? 0 : db);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === customers.length && customers.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(customers.map((c) => c.id)));
    }
  }

  async function handleBulkDelete() {
    setIsDeleting(true);
    const ids = Array.from(selectedIds);
    const results = await Promise.all(ids.map((id) => deleteCustomer(id)));
    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success);
    setIsDeleting(false);
    setConfirmDeleteOpen(false);
    setSelectedIds(new Set());
    qc.invalidateQueries({ queryKey: ["customers"] });

    if (failed.length === 0) {
      toast({ 
        title: language === "ar" 
          ? `تم حذف عدد ${succeeded} مسافر` 
          : `${succeeded} customer${succeeded !== 1 ? "s" : ""} deleted` 
      });
    } else {
      const blockedMsg = failed.some((r) => r.message?.includes("ticket"))
        ? (language === "ar" ? " لا يمكن حذف بعض المسافرين لارتباطهم بتذاكر نشطة." : " Some couldn't be deleted because they have existing tickets.")
        : "";
      toast({
        title: language === "ar" 
          ? `نجح حذف ${succeeded}، وفشل ${failed.length}` 
          : `${succeeded} deleted, ${failed.length} failed`,
        description: `${blockedMsg}`,
        variant: "destructive",
      });
    }
  }

  const allSelected = customers.length > 0 && selectedIds.size === customers.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < customers.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t("customers.title")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t("customers.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && selectedIds.size > 0 && (
            <Button
              variant="destructive"
              onClick={() => setConfirmDeleteOpen(true)}
              className="flex items-center gap-2"
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4" />
              {t("customers.deleteSelected")} ({selectedIds.size})
            </Button>
          )}
          <Button
            variant="outline"
            onClick={exportToExcel}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" /> {t("customers.exportBtn")}
          </Button>
          <Button
            variant="outline"
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-2"
          >
            <FileSpreadsheet className="h-4 w-4 text-green-600" />
            {t("customers.importBtn")}
          </Button>
          <Button onClick={() => setAddOpen(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> {t("customers.addBtn")}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 rtl:pl-3 rtl:pr-9"
                placeholder={t("customers.searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder={t("customers.allStatuses")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("customers.allStatuses")}</SelectItem>
                {CUSTOMER_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{t(`statuses.${s}`)}</SelectItem>
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
            <div className="text-center py-12 text-destructive">{t("common.failedToLoad")}</div>
          )}

          {!isLoading && !isError && customers.length === 0 && (
            <div className="flex flex-col items-center py-16 text-center">
              <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground font-medium">
                {language === "ar" ? "لم يتم العثور على عملاء" : "No customers found"}
              </p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                {search || statusFilter !== "all"
                  ? (language === "ar" ? "جرّب تعديل البحث أو المرشحات المحددة." : "Try adjusting your search or filters.")
                  : (language === "ar" ? "أضف مسافراً جديداً أو استورد من ملف إكسيل." : "Add your first customer or import from Excel.")}
              </p>
            </div>
          )}

          {!isLoading && customers.length > 0 && (
            <>
              <div className="hidden md:flex items-center border-b bg-muted/30">
                {isAdmin && (
                  <div className="pl-5 pr-2 flex-shrink-0">
                    <Checkbox
                      checked={allSelected}
                      ref={(el) => {
                        if (el) (el as HTMLButtonElement & { indeterminate?: boolean }).indeterminate = someSelected;
                      }}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </div>
                )}
                <div className="flex-1 grid grid-cols-[2fr_1fr_1.3fr_0.7fr_0.9fr_0.9fr_1fr_1fr_1fr_0.9fr_auto] gap-3 px-6 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <button type="button" onClick={() => toggleSort("name")} className="flex items-center hover:text-foreground transition-colors text-left">
                    {t("customers.table.name")}<SortIcon col="name" />
                  </button>
                  <span>{t("customers.table.uploadedBy")}</span>
                  <span>{t("customers.table.phone")}</span>
                  <span>{t("customers.table.status")}</span>
                  <span>{t("customers.table.passport")}</span>
                  <span>{t("customers.table.pnr")}</span>
                  <button type="button" onClick={() => toggleSort("bookingDate")} className="flex items-center hover:text-foreground transition-colors text-left">
                    {t("customers.table.bookingDate")}<SortIcon col="bookingDate" />
                  </button>
                  <span>{t("customers.table.travelDate")}</span>
                  <span>{t("customers.table.daysLeft")}</span>
                  <button type="button" onClick={() => toggleSort("netProfit")} className="flex items-center hover:text-foreground transition-colors text-left">
                    {t("customers.table.netProfit")}<SortIcon col="netProfit" />
                  </button>
                  <span className="w-4" />
                </div>
              </div>

              <div className="divide-y animate-in fade-in duration-300">
                {customers.map((c) => {
                  const profit = netProfit(c);
                  const selected = selectedIds.has(c.id);
                  return (
                    <div
                      key={c.id}
                      className={`flex items-center transition-colors ${selected ? "bg-primary/5" : "hover:bg-muted/30"}`}
                    >
                      {isAdmin && (
                        <div
                          className="pl-5 pr-2 flex-shrink-0 self-stretch flex items-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Checkbox
                            checked={selected}
                            onCheckedChange={() => toggleSelect(c.id)}
                            aria-label={`Select ${c.fullName}`}
                          />
                        </div>
                      )}
                      <Link href={`/customers/${c.id}`} className="flex-1 min-w-0">
                        <div className="grid md:grid-cols-[2fr_1fr_1.3fr_0.7fr_0.9fr_0.9fr_1fr_1fr_1fr_0.9fr_auto] grid-cols-1 gap-2 md:gap-3 px-6 py-3.5 cursor-pointer group items-center text-start">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                              style={{ background: "linear-gradient(135deg, #d4af37 0%, #f5d76e 50%, #d4af37 100%)", color: "#022c22" }}>
                              {c.fullName.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold truncate group-hover:text-primary transition-colors text-sm">{c.fullName}</div>
                            </div>
                          </div>

                          <div className="hidden md:block text-xs font-medium text-muted-foreground truncate">
                            {c.uploadedByName || "System"}
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
                              {t(`statuses.${c.status}`)}
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
                          
                          <div className="hidden md:block text-sm text-muted-foreground">
                            {c.travelDate ? formatShortDate(c.travelDate) : "—"}
                          </div>

                          <div className="hidden md:block">
                            {(() => {
                              const { label, color, days } = calculateDaysRemaining(c.travelDate);
                              return <span className={`text-xs ${color}`}>{formatDaysLeft(label, days, language)}</span>;
                            })()}
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
                            <ChevronRight className={cn("h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors", isRtl && "rotate-180")} />
                          </div>
                        </div>
                      </Link>
                    </div>
                  );
                })}
              </div>

              <div className="px-6 py-3 border-t text-xs text-muted-foreground flex items-center gap-3">
                <span>
                  {customers.length} {language === "ar" ? "مسافر" : `customer${customers.length !== 1 ? "s" : ""}`}
                </span>
                {customers.length !== allCustomers.length && (
                  <span className="text-muted-foreground/70">
                    {language === "ar" ? `(تمت تصفيتهم من إجمالي ${allCustomers.length})` : `(filtered from ${allCustomers.length})`}
                  </span>
                )}
                {isAdmin && selectedIds.size > 0 && (
                  <span className="text-primary font-medium">
                    {language === "ar" ? `تم تحديد ${selectedIds.size}` : `${selectedIds.size} selected`}
                  </span>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <CustomerFormSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSuccess={() => qc.invalidateQueries({ queryKey: ["customers"] })}
      />

      <ExcelImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={() => qc.invalidateQueries({ queryKey: ["customers"] })}
      />

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === "ar" ? `حذف ${selectedIds.size} عميل؟` : `Delete ${selectedIds.size} customer${selectedIds.size !== 1 ? "s" : ""}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === "ar" 
                ? "هذا الإجراء لا يمكن التراجع عنه. العملاء الذين لديهم تذاكر طيران نشطة لا يمكن حذفهم — سيتم تخطي أولئك العملاء." 
                : "This action cannot be undone. Customers with existing tickets cannot be deleted — those will be skipped and reported."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (language === "ar" ? "جاري الحذف..." : "Deleting…") : t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
