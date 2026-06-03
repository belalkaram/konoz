import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, ChevronsUpDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { VoiceInputButton } from "@/components/voice-input-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from "@/lib/formatters";
import {
  TICKET_STATUSES, PAYMENT_STATUSES, CURRENCIES,
} from "@/lib/ticket-constants";
import { cn } from "@/lib/utils";
import { useEmployee } from "@/contexts/employee-context";
import { useLanguage } from "@/contexts/language-context";
import { authFetch, BASE } from "@/lib/api";

interface Customer {
  id: number;
  fullName: string;
  phone: string | null;
}

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
}

const EMPTY_FORM = {
  customerId: "",
  employeeId: "",
  flightRoute: "",
  airline: "",
  flightNumber: "",
  departureDatetime: "",
  arrivalDatetime: "",
  price: "",
  currency: "KWD",
  pnr: "",
  ticketStatus: "quoted",
  paymentStatus: "unpaid",
  baggageDetails: "",
  notes: "",
};

function toLocalDatetimeInput(isoString: string | null): string {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function fetchTicket(id: number): Promise<{ ticket: Ticket }> {
  const res = await authFetch(`${BASE}/api/tickets/${id}`);
  if (!res.ok) throw new Error("Failed to fetch ticket");
  return res.json();
}

async function fetchCustomers(): Promise<{ customers: Customer[] }> {
  const res = await authFetch(`${BASE}/api/customers`);
  if (!res.ok) throw new Error("Failed to fetch customers");
  return res.json();
}

async function createTicket(data: Record<string, unknown>): Promise<{ ticket: Ticket }> {
  const res = await authFetch(`${BASE}/api/tickets`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to create ticket");
  return json;
}

async function updateTicket(id: number, data: Record<string, unknown>): Promise<{ ticket: Ticket }> {
  const res = await authFetch(`${BASE}/api/tickets/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to update ticket");
  return json;
}

export default function TicketForm() {
  const [isEditMatch, editParams] = useRoute("/tickets/:id/edit");
  const editId = isEditMatch ? Number(editParams?.id) : null;
  const isEdit = editId !== null && !isNaN(editId);

  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t, language, isRtl } = useLanguage();
  const qc = useQueryClient();

  const { employees } = useEmployee();
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [customerOpen, setCustomerOpen] = useState(false);

  const { data: ticketData, isLoading: ticketLoading } = useQuery({
    queryKey: ["ticket", editId],
    queryFn: () => fetchTicket(editId!),
    enabled: isEdit,
  });

  const { data: customersData } = useQuery({
    queryKey: ["customers"],
    queryFn: fetchCustomers,
    staleTime: 60_000,
  });

  const customers = customersData?.customers ?? [];

  useEffect(() => {
    if (isEdit && ticketData?.ticket) {
      const tData = ticketData.ticket;
      setForm({
        customerId: String(tData.customerId),
        employeeId: tData.employeeId ? String(tData.employeeId) : "",
        flightRoute: tData.flightRoute ?? "",
        airline: tData.airline ?? "",
        flightNumber: tData.flightNumber ?? "",
        departureDatetime: toLocalDatetimeInput(tData.departureDatetime),
        arrivalDatetime: toLocalDatetimeInput(tData.arrivalDatetime),
        price: tData.price ?? "",
        currency: tData.currency ?? "KWD",
        pnr: tData.pnr ?? "",
        ticketStatus: tData.ticketStatus,
        paymentStatus: tData.paymentStatus,
        baggageDetails: tData.baggageDetails ?? "",
        notes: tData.notes ?? "",
      });
    } else if (!isEdit) {
      const params = new URLSearchParams(window.location.search);
      const cid = params.get("customerId");
      if (cid) setForm((f) => ({ ...f, customerId: cid }));
    }
  }, [isEdit, ticketData]);

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.customerId) {
      errs.customerId = language === "ar" ? "يجب اختيار مسافر." : "Customer is required.";
    }
    if (!form.flightRoute.trim()) {
      errs.flightRoute = language === "ar" ? "يجب إدخال خط سير الرحلة." : "Flight route is required.";
    }
    if (!form.airline.trim()) {
      errs.airline = language === "ar" ? "يجب إدخال رمز شركة الطيران." : "Airline is required.";
    }
    if (!form.departureDatetime) {
      errs.departureDatetime = language === "ar" ? "يجب إدخال تاريخ المغادرة." : "Departure date/time is required.";
    }
    if (form.price && isNaN(parseFloat(form.price))) {
      errs.price = language === "ar" ? "يجب إدخال سعر صالح." : "Price must be a valid number.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function buildPayload() {
    const payload: Record<string, unknown> = {};
    if (form.customerId) payload.customerId = Number(form.customerId);
    payload.employeeId = form.employeeId ? Number(form.employeeId) : null;
    if (form.flightRoute) payload.flightRoute = form.flightRoute;
    else payload.flightRoute = null;
    if (form.airline) payload.airline = form.airline;
    else payload.airline = null;
    if (form.flightNumber) payload.flightNumber = form.flightNumber;
    else payload.flightNumber = null;
    payload.departureDatetime = form.departureDatetime ? new Date(form.departureDatetime).toISOString() : null;
    payload.arrivalDatetime = form.arrivalDatetime ? new Date(form.arrivalDatetime).toISOString() : null;
    payload.price = form.price ? form.price : null;
    payload.currency = form.currency || "KWD";
    payload.pnr = form.pnr || null;
    payload.ticketStatus = form.ticketStatus;
    payload.paymentStatus = form.paymentStatus;
    payload.baggageDetails = form.baggageDetails || null;
    payload.notes = form.notes || null;
    return payload;
  }

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      isEdit ? updateTicket(editId!, payload) : createTicket(payload),
    onSuccess: (data) => {
      toast({ title: isEdit ? (language === "ar" ? "تم تحديث التذكرة بنجاح" : "Ticket updated") : (language === "ar" ? "تم إصدار التذكرة بنجاح" : "Ticket created") });
      qc.invalidateQueries({ queryKey: ["tickets"] });
      qc.invalidateQueries({ queryKey: ["ticket", editId] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["accounting-report"] });
      navigate(`/tickets/${data.ticket.id}`);
    },
    onError: (e: Error) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    mutation.mutate(buildPayload());
  }

  function setField(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((errs) => { const e = { ...errs }; delete e[k]; return e; });
  }

  if (isEdit && ticketLoading) {
    return (
      <div className="space-y-4 max-w-2xl">
        <Skeleton className="h-8 w-48" />
        <Card><CardContent className="p-6 space-y-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </CardContent></Card>
      </div>
    );
  }

  const selectedCustomer = customers.find((c) => String(c.id) === form.customerId);

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(isEdit ? `/tickets/${editId}` : "/tickets")}
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{isEdit ? t("ticketForm.editTitle") : t("ticketForm.addTitle")}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {isEdit ? (language === "ar" ? "تعديل تفاصيل تذكرة الطيران أدناه." : "Update the ticket details below.") : (language === "ar" ? "املأ البيانات أدناه لإصدار وتسجيل تذكرة طيران جديدة." : "Fill in the ticket details to create a new ticket.")}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("ticketDetail.routeInfo")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("ticketForm.customerLabel")}</Label>
              <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className={cn("w-full justify-between font-normal text-start", errors.customerId && "border-destructive")}
                  >
                    {selectedCustomer ? (
                      <span>{selectedCustomer.fullName} {selectedCustomer.phone ? `· ${selectedCustomer.phone}` : ""}</span>
                    ) : (
                      <span className="text-muted-foreground">{t("ticketForm.selectCustomer")}...</span>
                    )}
                    <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command>
                    <CommandInput placeholder={t("customers.searchPlaceholder")} />
                    <CommandList>
                      <CommandEmpty>{t("employees.noEmployees")}</CommandEmpty>
                      <CommandGroup>
                        {customers.map((c) => (
                          <CommandItem
                            key={c.id}
                            value={`${c.fullName} ${c.phone ?? ""}`}
                            onSelect={() => {
                              setField("customerId", String(c.id));
                              setCustomerOpen(false);
                            }}
                          >
                            <Check
                              className={cn("me-2 h-4 w-4", form.customerId === String(c.id) ? "opacity-100" : "opacity-0")}
                            />
                            <div>
                              <div className="font-medium">{c.fullName}</div>
                              {c.phone && <div className="text-xs text-muted-foreground">{c.phone}</div>}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {errors.customerId && <p className="text-xs text-destructive">{errors.customerId}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>{t("employees.supervisor")}</Label>
              <Select value={form.employeeId || "unassigned"} onValueChange={(v) => setField("employeeId", v === "unassigned" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder={language === "ar" ? "غير مسند" : "Unassigned"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">{language === "ar" ? "غير مسند" : "Unassigned"}</SelectItem>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>{e.name} — {e.role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t("ticketForm.routeLabel")}</Label>
                <Input
                  placeholder="e.g. CAI → DXB"
                  value={form.flightRoute}
                  onChange={(e) => setField("flightRoute", e.target.value)}
                  className={cn(errors.flightRoute && "border-destructive")}
                />
                {errors.flightRoute && <p className="text-xs text-destructive">{errors.flightRoute}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>{t("ticketForm.airlineLabel")}</Label>
                <Input
                  placeholder="e.g. J9"
                  value={form.airline}
                  onChange={(e) => setField("airline", e.target.value)}
                  className={cn(errors.airline && "border-destructive")}
                />
                {errors.airline && <p className="text-xs text-destructive">{errors.airline}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t("ticketForm.flightNoLabel")}</Label>
                <Input
                  placeholder="e.g. 501"
                  value={form.flightNumber}
                  onChange={(e) => setField("flightNumber", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("ticketForm.pnrLabel")}</Label>
                <Input
                  placeholder="e.g. ABC123"
                  value={form.pnr}
                  onChange={(e) => setField("pnr", e.target.value.toUpperCase())}
                  className="font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t("ticketForm.departureLabel")}</Label>
                <Input
                  type="datetime-local"
                  value={form.departureDatetime}
                  onChange={(e) => setField("departureDatetime", e.target.value)}
                  className={cn(errors.departureDatetime && "border-destructive")}
                />
                {errors.departureDatetime && <p className="text-xs text-destructive">{errors.departureDatetime}</p>}
                {form.departureDatetime && !errors.departureDatetime && (
                  <p className="text-xs text-muted-foreground">{formatDate(form.departureDatetime)}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>{t("ticketForm.arrivalLabel")}</Label>
                <Input
                  type="datetime-local"
                  value={form.arrivalDatetime}
                  onChange={(e) => setField("arrivalDatetime", e.target.value)}
                />
                {form.arrivalDatetime && (
                  <p className="text-xs text-muted-foreground">{formatDate(form.arrivalDatetime)}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("ticketDetail.financialDetails")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t("ticketForm.priceLabel")}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.price}
                  onChange={(e) => setField("price", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("ticketForm.currencyLabel")}</Label>
                <Select value={form.currency} onValueChange={(v) => setField("currency", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t("ticketForm.statusLabel")}</Label>
                <Select value={form.ticketStatus} onValueChange={(v) => setField("ticketStatus", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TICKET_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{t(`statuses.${s}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("ticketForm.paymentLabel")}</Label>
                <Select value={form.paymentStatus} onValueChange={(v) => setField("paymentStatus", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{t(`statuses.${s}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("common.settings")} ({t("common.other")})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("ticketForm.baggageLabel")}</Label>
              <Input
                placeholder="e.g. 23kg checked + 7kg cabin"
                value={form.baggageDetails}
                onChange={(e) => setField("baggageDetails", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>{t("ticketDetail.notes")}</Label>
                <VoiceInputButton
                  onTranscript={(txt) => setField("notes", form.notes ? form.notes + " " + txt : txt)}
                  title={language === "ar" ? "إملاء صوتي" : "Dictate note"}
                />
              </div>
              <Textarea
                placeholder={language === "ar" ? "ملاحظات إضافية حول التذكرة..." : "Any additional notes about this ticket..."}
                rows={3}
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(isEdit ? `/tickets/${editId}` : "/tickets")}
          >
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? t("employees.saving") : isEdit ? t("ticketForm.btnSave") : t("ticketForm.btnCreate")}
          </Button>
        </div>
      </form>
    </div>
  );
}
