import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Edit, XCircle, CreditCard, Clock, User, Plane,
  History, FileText, ChevronRight, Trash2,
} from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { VoiceInputButton } from "@/components/voice-input-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDateTime, formatShortDate } from "@/lib/formatters";
import {
  TICKET_STATUS_COLORS, PAYMENT_STATUS_COLORS,
  TICKET_STATUSES, PAYMENT_STATUSES, CURRENCIES, PAYMENT_METHODS,
} from "@/lib/ticket-constants";
import { authFetch, BASE } from "@/lib/api";
import { useCurrentEmployee } from "@/contexts/employee-context";
import { useLanguage } from "@/contexts/language-context";
import { InvoiceView } from "@/components/InvoiceView";

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
  customerEmail: string | null;
}

interface HistoryEntry {
  id: number;
  ticketId: number;
  oldStatus: string | null;
  newStatus: string;
  changedBy: string | null;
  createdAt: string;
}

interface Payment {
  id: number;
  ticketId: number;
  amount: string;
  currency: string | null;
  paymentMethod: string | null;
  paymentStatus: string | null;
  paymentDate: string | null;
  notes: string | null;
  createdAt: string;
}

interface TicketDetail {
  ticket: Ticket;
  history: HistoryEntry[];
  payments: Payment[];
}

async function fetchTicketDetail(id: number): Promise<TicketDetail> {
  const res = await authFetch(`${BASE}/api/tickets/${id}`);
  if (!res.ok) throw new Error("Failed to fetch ticket");
  return res.json();
}

async function updateTicketStatus(id: number, ticketStatus: string): Promise<void> {
  const res = await authFetch(`${BASE}/api/tickets/${id}`, {
    method: "PUT",
    body: JSON.stringify({ ticketStatus }),
  });
  if (!res.ok) throw new Error("Failed to update status");
}

async function cancelTicket(id: number): Promise<void> {
  const res = await authFetch(`${BASE}/api/tickets/${id}`, {
    method: "PUT",
    body: JSON.stringify({ ticketStatus: "cancelled" }),
  });
  if (!res.ok) throw new Error("Failed to cancel ticket");
}

async function deleteTicketRequest(id: number): Promise<void> {
  const res = await authFetch(`${BASE}/api/tickets/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error((json as { message?: string }).message || "Failed to delete ticket");
  }
}

async function addPayment(ticketId: number, data: Record<string, unknown>): Promise<void> {
  const res = await authFetch(`${BASE}/api/payments`, {
    method: "POST",
    body: JSON.stringify({ ...data, ticketId }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to add payment");
}

async function fetchInvoiceData(id: number): Promise<any> {
  const res = await authFetch(`${BASE}/api/tickets/${id}/invoice`);
  if (!res.ok) throw new Error("Failed to fetch invoice");
  return res.json();
}

function InfoRow({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      {icon && <span className="text-muted-foreground mt-0.5 flex-shrink-0">{icon}</span>}
      <span className="text-muted-foreground w-36 flex-shrink-0 text-sm">{label}</span>
      <span className="font-medium text-sm break-all">{value ?? "—"}</span>
    </div>
  );
}

function AddPaymentDialog({
  ticketId,
  open,
  onClose,
}: { ticketId: number; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { t, language } = useLanguage();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("KWD");
  const [method, setMethod] = useState("cash");
  const [paymentDate, setPaymentDate] = useState(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  });
  const [notes, setNotes] = useState("");
  const [amountError, setAmountError] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      addPayment(ticketId, {
        amount,
        currency,
        paymentMethod: method,
        paymentDate: paymentDate ? new Date(paymentDate).toISOString() : undefined,
        notes: notes || null,
      }),
    onSuccess: () => {
      toast({ title: language === "ar" ? "تم تسجيل الدفعة بنجاح" : "Payment recorded" });
      qc.invalidateQueries({ queryKey: ["ticket", ticketId] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      onClose();
      setAmount(""); setNotes("");
    },
    onError: (e: Error) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setAmountError(language === "ar" ? "أدخل مبلغاً صالحاً أكبر من 0." : "Enter a valid amount greater than 0.");
      return;
    }
    setAmountError("");
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("ticketDetail.addPayment")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("ticketDetail.invoice.amount")} *</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setAmountError(""); }}
                className={amountError ? "border-destructive" : ""}
              />
              {amountError && <p className="text-xs text-destructive">{amountError}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>{t("ticketForm.currencyLabel")}</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("ticketDetail.paymentStatus")}</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>{t(`statuses.${m}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("common.date")}</Label>
            <Input
              type="datetime-local"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>{t("ticketDetail.notes")} ({t("common.other")})</Label>
              <VoiceInputButton
                onTranscript={(txt) => setNotes((prev) => prev ? prev + " " + txt : txt)}
                title={language === "ar" ? "إملاء صوتي" : "Dictate note"}
              />
            </div>
            <Textarea
              rows={2}
              placeholder={language === "ar" ? "أية ملاحظات حول عملية الدفع هذه..." : "Any notes about this payment..."}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? t("employees.saving") : t("ticketDetail.addPayment")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function TicketDetail() {
  const [, params] = useRoute("/tickets/:id");
  const [, navigate] = useLocation();
  const id = Number(params?.id);

  const { toast } = useToast();
  const qc = useQueryClient();
  const { t, language, isRtl } = useLanguage();

  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceMode, setInvoiceMode] = useState<"customer" | "admin">("customer");
  const [statusValue, setStatusValue] = useState("");

  const currentEmployee = useCurrentEmployee();
  const isAdmin = currentEmployee.role === "Administrator";
  const isSupervisor = currentEmployee.role === "Supervisor";

  const { data, isLoading, isError } = useQuery({
    queryKey: ["ticket", id],
    queryFn: () => fetchTicketDetail(id),
    enabled: !isNaN(id),
  });

  const { data: invoiceData, isLoading: isLoadingInvoice } = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => fetchInvoiceData(id),
    enabled: invoiceOpen,
  });

  useEffect(() => {
    if (data?.ticket && !statusValue) {
      setStatusValue(data.ticket.ticketStatus);
    }
  }, [data?.ticket?.ticketStatus]);

  const statusMutation = useMutation({
    mutationFn: (newStatus: string) => updateTicketStatus(id, newStatus),
    onSuccess: () => {
      toast({ title: language === "ar" ? "تم تحديث الحالة بنجاح" : "Status updated" });
      qc.invalidateQueries({ queryKey: ["ticket", id] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (e: Error, _newStatus, _ctx) => {
      setStatusValue(data?.ticket?.ticketStatus ?? "");
      toast({ title: t("common.error"), description: e.message, variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelTicket(id),
    onSuccess: () => {
      toast({ title: language === "ar" ? "تم إلغاء التذكرة بنجاح" : "Ticket cancelled" });
      qc.invalidateQueries({ queryKey: ["ticket", id] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setStatusValue("cancelled");
      setCancelOpen(false);
    },
    onError: (e: Error) => {
      toast({ title: t("common.error"), description: e.message, variant: "destructive" });
      setCancelOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteTicketRequest(id),
    onSuccess: () => {
      toast({ title: language === "ar" ? `تم حذف التذكرة #${id}` : `Ticket #${id} deleted` });
      qc.invalidateQueries({ queryKey: ["tickets"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      navigate("/tickets");
    },
    onError: (e: Error) => {
      toast({ title: t("common.error"), description: e.message, variant: "destructive" });
      setDeleteOpen(false);
    },
  });

  if (isNaN(id)) return <div className="text-destructive p-6">{language === "ar" ? "معرف تذكرة غير صالح." : "Invalid ticket ID."}</div>;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Card><CardContent className="p-6 space-y-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
        </CardContent></Card>
      </div>
    );
  }

  if (isError || !data) return <div className="text-destructive p-6">{language === "ar" ? "التذكرة غير موجودة." : "Ticket not found."}</div>;

  const { ticket, history, payments } = data;
  const currentStatus = statusValue || ticket.ticketStatus;

  function handleStatusChange(newStatus: string) {
    setStatusValue(newStatus);
    if (newStatus !== ticket.ticketStatus) {
      statusMutation.mutate(newStatus);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/tickets")}>
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight">{t("ticketDetail.title")} #{ticket.id}</h1>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${TICKET_STATUS_COLORS[ticket.ticketStatus] ?? ""}`}>
                {t(`statuses.${ticket.ticketStatus}`)}
              </span>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${PAYMENT_STATUS_COLORS[ticket.paymentStatus] ?? ""}`}>
                {t(`statuses.${ticket.paymentStatus}`)}
              </span>
            </div>
            <p className="text-muted-foreground text-sm mt-0.5">
              {language === "ar" ? `تم الإنشاء في ${formatDateTime(ticket.createdAt)}` : `Created ${formatDateTime(ticket.createdAt)}`}
            </p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setPaymentOpen(true)}>
            <CreditCard className="h-4 w-4 mr-1.5 rtl:mr-0 rtl:ml-1.5" /> {t("ticketDetail.addPayment")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setInvoiceOpen(true)}>
            <FileText className="h-4 w-4 mr-1.5 rtl:mr-0 rtl:ml-1.5" /> {t("ticketDetail.invoiceBtn")}
          </Button>

          <Link href={`/tickets/${id}/edit`}>
            <Button variant="outline" size="sm">
              <Edit className="h-4 w-4 mr-1.5 rtl:mr-0 rtl:ml-1.5" /> {t("common.edit")}
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            className="border-destructive text-destructive hover:bg-destructive/10"
            onClick={() => setCancelOpen(true)}
            disabled={ticket.ticketStatus === "cancelled"}
          >
            <XCircle className="h-4 w-4 mr-1.5 rtl:mr-0 rtl:ml-1.5" /> {language === "ar" ? "إلغاء التذكرة" : "Cancel Ticket"}
          </Button>
          {isAdmin && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteOpen(true)}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-1.5 rtl:mr-0 rtl:ml-1.5" /> {language === "ar" ? "حذف التذكرة" : "Delete Ticket"}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Plane className="h-4 w-4 text-muted-foreground" /> {t("ticketDetail.routeInfo")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <InfoRow label={t("ticketDetail.pnr")} value={ticket.pnr ? <span className="font-mono">{ticket.pnr}</span> : null} />
            <InfoRow label={t("ticketDetail.airline")} value={ticket.airline} />
            <InfoRow label={t("ticketDetail.flightNo")} value={ticket.flightNumber} />
            <InfoRow label={t("ticketDetail.route")} value={ticket.flightRoute} />
            <InfoRow label={t("ticketDetail.departure")} value={ticket.departureDatetime ? formatDateTime(ticket.departureDatetime) : null} />
            <InfoRow label={t("ticketDetail.arrival")} value={ticket.arrivalDatetime ? formatDateTime(ticket.arrivalDatetime) : null} />
            <InfoRow label={t("ticketDetail.baggage")} value={ticket.baggageDetails} />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" /> {t("tickets.table.customer")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ticket.customerName ? (
                <Link href={`/customers/${ticket.customerId}`}>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors cursor-pointer group">
                    <div>
                      <div className="font-semibold">{ticket.customerName}</div>
                      {ticket.customerPhone && (
                        <div className="text-sm text-muted-foreground">{ticket.customerPhone}</div>
                      )}
                      {ticket.customerEmail && (
                        <div className="text-sm text-muted-foreground">{ticket.customerEmail}</div>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground rtl:rotate-180" />
                  </div>
                </Link>
              ) : (
                <p className="text-muted-foreground text-sm">{language === "ar" ? "لا يوجد عميل مرتبط." : "No customer linked."}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" /> {t("ticketDetail.financialDetails")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <InfoRow label={t("ticketDetail.sellingPrice")} value={ticket.price ? formatCurrency(ticket.price, ticket.currency) : null} />
              <InfoRow label={t("ticketForm.currencyLabel")} value={ticket.currency} />
              <InfoRow label={t("common.status")} value={
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PAYMENT_STATUS_COLORS[ticket.paymentStatus] ?? ""}`}>
                  {t(`statuses.${ticket.paymentStatus}`)}
                </span>
              } />
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("customerProfile.changeStatus")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={currentStatus} onValueChange={handleStatusChange} disabled={statusMutation.isPending}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TICKET_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{t(`statuses.${s}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {statusMutation.isPending && <span className="text-sm text-muted-foreground">{t("employees.saving")}</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" /> {t("ticketDetail.notes")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ticket.notes ? (
            <p className="text-sm whitespace-pre-wrap">{ticket.notes}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">{language === "ar" ? "لا توجد ملاحظات لهذه التذكرة." : "No notes added for this ticket."}</p>
          )}
        </CardContent>
      </Card>

      {payments.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" /> {t("ticketDetail.paymentHistory")}
              <span className="ml-auto rtl:ml-0 rtl:mr-auto text-sm font-normal text-muted-foreground">
                {t("ticketDetail.invoice.total")}: {formatCurrency(
                  payments.reduce((sum, p) => sum + parseFloat(p.amount || "0"), 0),
                  payments[0]?.currency ?? ticket.currency
                )}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <div className="font-medium text-sm">{formatCurrency(p.amount, p.currency)}</div>
                    <div className="text-xs text-muted-foreground">
                      {t(`statuses.${p.paymentMethod ?? "other"}`)}
                      {p.paymentDate ? ` · ${formatShortDate(p.paymentDate)}` : ""}
                    </div>
                    {p.notes && <div className="text-xs text-muted-foreground mt-0.5">{p.notes}</div>}
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PAYMENT_STATUS_COLORS[p.paymentStatus ?? ""] ?? ""}`}>
                    {t(`statuses.${p.paymentStatus ?? ""}`)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" /> {t("ticketDetail.paymentHistory")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">{language === "ar" ? "لا يوجد سجل للحالات." : "No status changes recorded."}</p>
          ) : (
            <div className="relative pl-6 rtl:pl-0 rtl:pr-6 space-y-4">
              <div className="absolute left-2 rtl:left-auto rtl:right-2 top-2 bottom-2 w-px bg-border" />
              {history.map((entry, i) => (
                <div key={entry.id} className="relative">
                  <div className={`absolute -left-4 rtl:-left-auto rtl:-right-4 w-3 h-3 rounded-full border-2 border-background ${i === 0 ? "bg-primary" : "bg-muted-foreground/40"}`} />
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium">
                        {entry.oldStatus ? (
                          <>
                            <span className={`inline-flex text-xs px-1.5 py-0.5 rounded ${TICKET_STATUS_COLORS[entry.oldStatus] ?? "bg-gray-100 text-gray-700"}`}>
                              {t(`statuses.${entry.oldStatus}`)}
                            </span>
                            {" → "}
                          </>
                        ) : (language === "ar" ? "تم الإنشاء كـ " : "Created as ")}
                        <span className={`inline-flex text-xs px-1.5 py-0.5 rounded ${TICKET_STATUS_COLORS[entry.newStatus] ?? "bg-gray-100 text-gray-700"}`}>
                          {t(`statuses.${entry.newStatus}`)}
                        </span>
                      </div>
                      {entry.changedBy && (
                        <div className="text-xs text-muted-foreground mt-0.5">{language === "ar" ? "بواسطة" : "by"} {entry.changedBy}</div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground flex-shrink-0 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDateTime(entry.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AddPaymentDialog ticketId={id} open={paymentOpen} onClose={() => setPaymentOpen(false)} />

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{language === "ar" ? `إلغاء التذكرة #${id}؟` : `Cancel Ticket #${id}?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {language === "ar" 
                ? "سيؤدي هذا إلى تغيير حالة التذكرة إلى ملغاة. سيتم الاحتفاظ بسجل التذاكر والمدفوعات والتاريخ بالكامل. يمكنك تغيير الحالة مجدداً لاحقاً." 
                : "This will change the ticket status to Cancelled. The ticket record, history, and payments will all be preserved. You can change the status again from the ticket detail page."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{language === "ar" ? "الاحتفاظ بالتذكرة" : "Keep Ticket"}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? t("employees.deactivating") : (language === "ar" ? "إلغاء التذكرة" : "Cancel Ticket")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{language === "ar" ? `حذف التذكرة #${id}؟` : `Delete Ticket #${id}?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("tickets.deleteConfirmDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? t("employees.revoking") : t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}>
        <DialogContent className="max-w-5xl h-[90vh] overflow-y-auto p-0 flex flex-col">
          <DialogHeader className="p-6 pb-2 print:hidden flex flex-row items-center justify-between">
            <DialogTitle>{t("ticketDetail.invoiceBtn")}</DialogTitle>
            {(isAdmin || isSupervisor) && (
              <div className="flex bg-muted p-1 rounded-md">
                <Button 
                  variant={invoiceMode === "customer" ? "secondary" : "ghost"} 
                  size="sm"
                  onClick={() => setInvoiceMode("customer")}
                  className="text-xs"
                >
                  {language === "ar" ? "نسخة العميل" : "Customer Copy"}
                </Button>
                <Button 
                  variant={invoiceMode === "admin" ? "secondary" : "ghost"} 
                  size="sm"
                  onClick={() => setInvoiceMode("admin")}
                  className="text-xs"
                >
                  {language === "ar" ? "النسخة الإدارية" : "Admin Copy"}
                </Button>
              </div>
            )}
          </DialogHeader>
          <div className="flex-1">
            {isLoadingInvoice ? (
              <div className="p-8 space-y-4">
                <Skeleton className="h-12 w-3/4" />
                <Skeleton className="h-64 w-full" />
              </div>
            ) : invoiceData ? (
              <InvoiceView 
                invoice={invoiceData.invoice}
                ticket={{
                  ...invoiceData.ticket,
                  passengerName: invoiceData.ticket.customerName
                }}
                customer={{
                  name: invoiceData.ticket.customerName,
                  email: invoiceData.ticket.customerEmail,
                  phone: invoiceData.ticket.customerPhone
                }}
                isAdmin={invoiceMode === "admin"}
              />
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                {language === "ar" ? "فشل في تحميل بيانات الفاتورة." : "Failed to load invoice data."}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
