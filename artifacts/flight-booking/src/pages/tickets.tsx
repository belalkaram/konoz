import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Tag, Plus, Search, Plane } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatShortDate } from "@/lib/formatters";
import {
  TICKET_STATUS_COLORS, TICKET_STATUS_LABELS, PAYMENT_STATUS_COLORS, PAYMENT_STATUS_LABELS,
  TICKET_STATUSES, PAYMENT_STATUSES,
} from "@/lib/ticket-constants";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Ticket {
  id: number;
  customerId: number;
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

async function fetchTickets(): Promise<{ tickets: Ticket[] }> {
  const res = await fetch(`${BASE}/api/tickets`);
  if (!res.ok) throw new Error("Failed to fetch tickets");
  return res.json();
}

export default function Tickets() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["tickets"],
    queryFn: fetchTickets,
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Tickets</h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage all customer flight tickets.</p>
        </div>
        <Link href="/tickets/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" /> Add Ticket
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search by customer name, PNR, or route..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Ticket status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {TICKET_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{TICKET_STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Payment status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All payments</SelectItem>
                {PAYMENT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{PAYMENT_STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading && (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          )}

          {isError && (
            <div className="text-destructive text-center py-8">Failed to load tickets.</div>
          )}

          {!isLoading && !isError && tickets.length === 0 && (
            <div className="text-center py-16">
              <Tag className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-20" />
              <p className="font-medium">No tickets found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {allTickets.length === 0
                  ? "Start by adding your first ticket."
                  : "Try adjusting your search or filters."}
              </p>
              {allTickets.length === 0 && (
                <Link href="/tickets/new">
                  <Button className="mt-4" size="sm">Add Ticket</Button>
                </Link>
              )}
            </div>
          )}

          {!isLoading && !isError && tickets.length > 0 && (
            <>
              <div className="hidden md:block overflow-x-auto -mx-4 px-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Route</TableHead>
                      <TableHead>Airline</TableHead>
                      <TableHead>Departure</TableHead>
                      <TableHead>PNR</TableHead>
                      <TableHead>Ticket Status</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tickets.map((t) => (
                      <TableRow
                        key={t.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/tickets/${t.id}`)}
                      >
                        <TableCell className="font-medium">
                          {t.customerName ?? <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          {t.flightRoute ? (
                            <span className="flex items-center gap-1 text-sm">
                              <Plane className="h-3 w-3 text-muted-foreground" /> {t.flightRoute}
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell>{t.airline ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {t.departureDatetime ? formatShortDate(t.departureDatetime) : "—"}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{t.pnr ?? "—"}</TableCell>
                        <TableCell>
                          <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${TICKET_STATUS_COLORS[t.ticketStatus] ?? "bg-gray-100 text-gray-700"}`}>
                            {TICKET_STATUS_LABELS[t.ticketStatus] ?? t.ticketStatus}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${PAYMENT_STATUS_COLORS[t.paymentStatus] ?? ""}`}>
                            {PAYMENT_STATUS_LABELS[t.paymentStatus] ?? t.paymentStatus}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {t.price ? formatCurrency(t.price, t.currency) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="md:hidden space-y-2">
                {tickets.map((t) => (
                  <Link key={t.id} href={`/tickets/${t.id}`}>
                    <div className="border rounded-lg p-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-semibold text-sm">{t.customerName ?? "Unknown"}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TICKET_STATUS_COLORS[t.ticketStatus] ?? ""}`}>
                          {TICKET_STATUS_LABELS[t.ticketStatus] ?? t.ticketStatus}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{t.flightRoute ?? "—"} {t.airline ? `· ${t.airline}` : ""}</span>
                        <span className="font-medium text-foreground">{t.price ? formatCurrency(t.price, t.currency) : "—"}</span>
                      </div>
                      {t.pnr && <div className="text-xs text-muted-foreground mt-1">PNR: <span className="font-mono">{t.pnr}</span></div>}
                    </div>
                  </Link>
                ))}
              </div>

              <div className="text-sm text-muted-foreground pt-1">
                {tickets.length} ticket{tickets.length !== 1 ? "s" : ""}
                {tickets.length !== allTickets.length && ` (filtered from ${allTickets.length})`}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
