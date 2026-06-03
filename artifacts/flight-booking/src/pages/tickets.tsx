import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import { Tag, Plus, Search, Plane, UserCheck, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatShortDate, calculateDaysRemaining } from "@/lib/formatters";
import {
  TICKET_STATUS_COLORS, PAYMENT_STATUS_COLORS,
  TICKET_STATUSES, PAYMENT_STATUSES,
} from "@/lib/ticket-constants";
import { useCurrentEmployee, useEmployee } from "@/contexts/employee-context";
import { useLanguage } from "@/contexts/language-context";
import { authFetch, BASE } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/page-header";
import { SecurityEyeToggle } from "@/components/security-eye-toggle";
import { SecretNumber } from "@/components/secret-number";

interface Ticket {
  id: number;
  customerId: number;
  employeeId: number | null;
  flightRoute: string | null;
  airline: string | null;
  flightNumber: string | null;
  departureDatetime: string | null;
  arrivalDatetime: string | null;
  price: string | null;
  currency: string | null;
  pnr: string | null;
  ticketStatus: string;
  paymentStatus: string;
  baggageDetails: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  customerName: string | null;
  customerPhone: string | null;
}

async function fetchTickets(employeeId?: number): Promise<{ tickets: Ticket[] }> {
  const params = new URLSearchParams();
  if (employeeId) params.set("employeeId", String(employeeId));
  const url = `${BASE}/api/tickets${params.toString() ? `?${params}` : ""}`;
  const res = await authFetch(url);
  if (!res.ok) throw new Error("Failed to fetch tickets");
  return res.json();
}

async function deleteTicket(id: number): Promise<{ success?: boolean; message?: string }> {
  const res = await authFetch(`${BASE}/api/tickets/${id}`, { method: "DELETE" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { message: (json as { message?: string }).message || "Failed to delete" };
  return { success: true };
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

export default function Tickets() {
  const [, navigate] = useLocation();
  const search_params = useSearch();
  const initialEmployeeId = new URLSearchParams(search_params).get("employeeId") ?? "all";
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [employeeFilter, setEmployeeFilter] = useState(initialEmployeeId);
  const [myTickets, setMyTickets] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const currentEmployee = useCurrentEmployee();
  const { employees } = useEmployee();
  const { toast } = useToast();
  const { t, language, isRtl } = useLanguage();
  const qc = useQueryClient();
  const isAdmin = currentEmployee.role === "Administrator";

  const activeEmployeeId = myTickets
    ? currentEmployee.id
    : employeeFilter !== "all"
    ? Number(employeeFilter)
    : undefined;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["tickets", activeEmployeeId],
    queryFn: () => fetchTickets(activeEmployeeId),
    staleTime: 30_000,
  });

  const allTickets = data?.tickets ?? [];

  const tickets = allTickets.filter((t) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      (t.customerName ?? "").toLowerCase().includes(q) ||
      (t.pnr ?? "").toLowerCase().includes(q) ||
      (t.flightRoute ?? "").toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || t.ticketStatus === statusFilter;
    const matchesPayment = paymentFilter === "all" || t.paymentStatus === paymentFilter;
    return matchesSearch && matchesStatus && matchesPayment;
  });

  function toggleMyTickets() {
    setMyTickets((v) => {
      if (!v) setEmployeeFilter("all");
      return !v;
    });
  }

  function handleEmployeeFilter(val: string) {
    setEmployeeFilter(val);
    if (val !== "all") setMyTickets(false);
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === tickets.length && tickets.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tickets.map((t) => t.id)));
    }
  }

  async function handleBulkDelete() {
    setIsDeleting(true);
    const ids = Array.from(selectedIds);
    const results = await Promise.all(ids.map((id) => deleteTicket(id)));
    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    setIsDeleting(false);
    setConfirmDeleteOpen(false);
    setSelectedIds(new Set());
    qc.invalidateQueries({ queryKey: ["tickets"] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });

    if (failed === 0) {
      toast({ title: language === "ar" ? `تم حذف ${succeeded} تذكرة` : `${succeeded} ticket${succeeded !== 1 ? "s" : ""} deleted` });
    } else {
      toast({
        title: language === "ar" ? `تم حذف ${succeeded}، وفشل ${failed}` : `${succeeded} deleted, ${failed} failed`,
        variant: "destructive",
      });
    }
  }

  const allSelected = tickets.length > 0 && selectedIds.size === tickets.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < tickets.length;
  const selectValue = myTickets ? String(currentEmployee.id) : employeeFilter;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("tickets.title")}
        description={t("tickets.subtitle")}
        icon={Tag}
        actions={
          <>
            <SecurityEyeToggle />
            {isAdmin && selectedIds.size > 0 && (
              <Button
                variant="destructive"
                onClick={() => setConfirmDeleteOpen(true)}
                disabled={isDeleting}
                className="gap-1.5"
              >
                <Trash2 className="h-4 w-4" />
                {language === "ar" ? `حذف المحدد (${selectedIds.size})` : `Delete Selected (${selectedIds.size})`}
              </Button>
            )}
            <Link href="/tickets/new">
              <Button>
                <Plus className="h-4 w-4 me-2" /> {t("tickets.newTicket")}
              </Button>
            </Link>
          </>
        }
      />

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="ps-9 pe-3"
                placeholder={t("tickets.searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder={t("tickets.allStatuses")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("tickets.allStatuses")}</SelectItem>
                {TICKET_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{t(`statuses.${s}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder={t("tickets.allPayments")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("tickets.allPayments")}</SelectItem>
                {PAYMENT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{t(`statuses.${s}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectValue} onValueChange={handleEmployeeFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder={t("supervisor.allEmployees")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("supervisor.allEmployees")}</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={myTickets ? "default" : "outline"}
              size="sm"
              className="h-10 gap-1.5 whitespace-nowrap"
              onClick={toggleMyTickets}
            >
              <UserCheck className="h-4 w-4" />
              {t("tickets.myTickets")}
            </Button>
          </div>

          {isLoading && (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          )}

          {isError && (
            <div className="text-destructive text-center py-8">{t("common.failedToLoad")}</div>
          )}

          {!isLoading && !isError && tickets.length === 0 && (
            <div className="text-center py-16">
              <Tag className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-20" />
              <p className="font-medium">{t("tickets.noTicketsFound")}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {allTickets.length === 0
                  ? myTickets || activeEmployeeId
                    ? t("tickets.noTicketsDesc1")
                    : t("tickets.noTicketsDesc2")
                  : t("tickets.noTicketsDesc3")}
              </p>
              {allTickets.length === 0 && !myTickets && !activeEmployeeId && (
                <Link href="/tickets/new">
                  <Button className="mt-4" size="sm">{t("tickets.newTicket")}</Button>
                </Link>
              )}
            </div>
          )}

          {!isLoading && !isError && tickets.length > 0 && (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto -mx-4 px-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {isAdmin && (
                        <TableHead className="w-10">
                          <Checkbox
                            checked={allSelected}
                            ref={(el) => {
                              if (el) (el as HTMLButtonElement & { indeterminate?: boolean }).indeterminate = someSelected;
                            }}
                            onCheckedChange={toggleSelectAll}
                            aria-label="Select all"
                          />
                        </TableHead>
                      )}
                      <TableHead>{t("tickets.table.customer")}</TableHead>
                      <TableHead>{t("tickets.table.route")}</TableHead>
                      <TableHead>{t("tickets.table.airline")}</TableHead>
                      <TableHead>{t("tickets.table.travelDate")}</TableHead>
                      <TableHead>{t("common.daysLeft")}</TableHead>
                      <TableHead>{t("tickets.table.pnr")}</TableHead>
                      <TableHead>{t("reports.table.employee")}</TableHead>
                      <TableHead>{t("tickets.table.status")}</TableHead>
                      <TableHead>{t("tickets.table.payment")}</TableHead>
                      <TableHead className="text-end">{t("tickets.table.sellingPrice")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tickets.map((tRow) => {
                      const selected = selectedIds.has(tRow.id);
                      return (
                        <TableRow
                          key={tRow.id}
                          className={`cursor-pointer ${selected ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/50"}`}
                          onClick={() => navigate(`/tickets/${tRow.id}`)}
                        >
                          {isAdmin && (
                            <TableCell
                              onClick={(e) => { e.stopPropagation(); toggleSelect(tRow.id); }}
                              className="w-10"
                            >
                              <Checkbox
                                checked={selected}
                                onCheckedChange={() => toggleSelect(tRow.id)}
                                aria-label={`Select ticket ${tRow.id}`}
                              />
                            </TableCell>
                          )}
                          <TableCell className="font-medium">
                            {tRow.customerName ?? <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell>
                            {tRow.flightRoute ? (
                              <span className="flex items-center gap-1 text-sm">
                                <Plane className="h-3 w-3 text-muted-foreground" /> {tRow.flightRoute}
                              </span>
                            ) : "—"}
                          </TableCell>
                          <TableCell>{tRow.airline ?? "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {tRow.departureDatetime ? formatShortDate(tRow.departureDatetime) : "—"}
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const { label, color, days } = calculateDaysRemaining(tRow.departureDatetime);
                              return <span className={`text-xs ${color}`}>{formatDaysLeft(label, days, language)}</span>;
                            })()}
                          </TableCell>
                          <TableCell className="font-mono text-sm">{tRow.pnr ?? "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {tRow.employeeId
                              ? (employees.find((e) => e.id === tRow.employeeId)?.name ?? `#${tRow.employeeId}`)
                              : <span className="text-muted-foreground/50">—</span>}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${TICKET_STATUS_COLORS[tRow.ticketStatus] ?? "bg-gray-100 text-gray-700"}`}>
                              {t(`statuses.${tRow.ticketStatus}`)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${PAYMENT_STATUS_COLORS[tRow.paymentStatus] ?? ""}`}>
                              {t(`statuses.${tRow.paymentStatus}`)}
                            </span>
                          </TableCell>
                          <TableCell className="text-end font-medium">
                            {tRow.price ? <SecretNumber>{formatCurrency(tRow.price, tRow.currency)}</SecretNumber> : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-2">
                {tickets.map((tRow) => (
                  <Link key={tRow.id} href={`/tickets/${tRow.id}`}>
                    <div className="border rounded-lg p-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-semibold text-sm">{tRow.customerName ?? "Unknown"}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TICKET_STATUS_COLORS[tRow.ticketStatus] ?? ""}`}>
                          {t(`statuses.${tRow.ticketStatus}`)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{tRow.flightRoute ?? "—"} {tRow.airline ? `· ${tRow.airline}` : ""}</span>
                        <span className="font-medium text-foreground">
                          {tRow.price ? <SecretNumber>{formatCurrency(tRow.price, tRow.currency)}</SecretNumber> : "—"}
                        </span>
                      </div>
                      {tRow.pnr && <div className="text-xs text-muted-foreground mt-1">{t("tickets.table.pnr")}: <span className="font-mono">{tRow.pnr}</span></div>}
                      {tRow.employeeId && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {t("reports.table.employee")}: {employees.find((e) => e.id === tRow.employeeId)?.name ?? `#${tRow.employeeId}`}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>

              <div className="text-sm text-muted-foreground pt-1 flex items-center gap-3">
                <span>
                  {tickets.length} {language === "ar" ? "تذكرة" : `ticket${tickets.length !== 1 ? "s" : ""}`}
                  {tickets.length !== allTickets.length && ` (${language === "ar" ? "مصفى من" : "filtered from"} ${allTickets.length})`}
                  {myTickets && <span className="ml-2 text-xs font-medium text-primary">· {t("tickets.myTickets")} {language === "ar" ? "فقط" : "only"}</span>}
                </span>
                {isAdmin && selectedIds.size > 0 && (
                  <span className="text-primary font-medium">{selectedIds.size} {language === "ar" ? "محدد" : "selected"}</span>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("tickets.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("tickets.deleteConfirmDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? t("employees.revoking") : t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
