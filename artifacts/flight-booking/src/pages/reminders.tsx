import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCircle2, Clock, AlertCircle, Calendar, ChevronRight, Filter } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/formatters";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface FollowUpNote {
  id: number;
  customerId: number | null;
  note: string;
  followUpDate: string | null;
  followUpStatus: string | null;
  employeeId: number | null;
  ticketId: number | null;
  createdAt: string;
  customerName: string | null;
  customerPhone: string | null;
}

interface FollowUpsResponse {
  today: FollowUpNote[];
  upcoming: FollowUpNote[];
  missed: FollowUpNote[];
  done: FollowUpNote[];
  all: FollowUpNote[];
  pending: FollowUpNote[];
}

async function fetchFollowUps(): Promise<FollowUpsResponse> {
  const res = await fetch(`${BASE}/api/followups`);
  if (!res.ok) throw new Error("Failed to fetch follow-ups");
  return res.json();
}

async function markNoteDone(id: number): Promise<void> {
  const res = await fetch(`${BASE}/api/notes/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ followUpStatus: "done" }),
  });
  if (!res.ok) throw new Error("Failed to mark as done");
}

function NoteItem({ note, showMarkDone }: { note: FollowUpNote; showMarkDone?: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const markDone = useMutation({
    mutationFn: () => markNoteDone(note.id),
    onSuccess: () => {
      toast({ title: "Marked as done" });
      qc.invalidateQueries({ queryKey: ["followups"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="border rounded-lg p-3 bg-card flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm line-clamp-2 mb-1.5">{note.note}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          {note.followUpDate && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3 flex-shrink-0" />
              {formatDateTime(note.followUpDate)}
            </span>
          )}
          {note.ticketId && (
            <Link href={`/tickets/${note.ticketId}`}>
              <span className="hover:underline cursor-pointer">Ticket #{note.ticketId}</span>
            </Link>
          )}
          {note.employeeId && <span>Employee #{note.employeeId}</span>}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        {showMarkDone && note.followUpStatus !== "done" && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs px-2"
            disabled={markDone.isPending}
            onClick={() => markDone.mutate()}
          >
            <CheckCircle2 className="h-3 w-3 mr-1" /> Done
          </Button>
        )}
        {note.customerId && (
          <Link href={`/customers/${note.customerId}`}>
            <Button size="sm" variant="ghost" className="h-7 text-xs px-2">
              View <ChevronRight className="h-3 w-3 ml-0.5" />
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

interface CustomerGroup {
  customerId: number | null;
  customerName: string | null;
  notes: FollowUpNote[];
}

function groupByCustomer(notes: FollowUpNote[]): CustomerGroup[] {
  const map = new Map<string, CustomerGroup>();
  for (const note of notes) {
    const key = String(note.customerId ?? "none");
    if (!map.has(key)) {
      map.set(key, { customerId: note.customerId, customerName: note.customerName, notes: [] });
    }
    map.get(key)!.notes.push(note);
  }
  return Array.from(map.values());
}

function NoteGroupList({ notes, showMarkDone }: { notes: FollowUpNote[]; showMarkDone?: boolean }) {
  const groups = groupByCustomer(notes);
  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={String(group.customerId ?? "none")}>
          <div className="flex items-center gap-2 mb-2">
            {group.customerId ? (
              <Link href={`/customers/${group.customerId}`}>
                <span className="font-semibold text-sm hover:underline text-primary cursor-pointer">
                  {group.customerName ?? "Unknown customer"}
                </span>
              </Link>
            ) : (
              <span className="font-semibold text-sm text-muted-foreground">Unknown customer</span>
            )}
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
              {group.notes.length}
            </span>
          </div>
          <div className="space-y-2 pl-3 border-l-2 border-border">
            {group.notes.map((note) => (
              <NoteItem key={note.id} note={note} showMarkDone={showMarkDone} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyTab({ label }: { label: string }) {
  return (
    <div className="text-center py-16 text-muted-foreground">
      <Bell className="h-10 w-10 mx-auto mb-3 opacity-20" />
      <p className="font-medium">No {label} follow-ups</p>
    </div>
  );
}

function applyFilters(
  notes: FollowUpNote[],
  employeeFilter: string,
  startDate: string,
  endDate: string
): FollowUpNote[] {
  return notes.filter((n) => {
    if (employeeFilter && n.employeeId !== Number(employeeFilter)) return false;
    if (startDate && n.followUpDate && new Date(n.followUpDate) < new Date(startDate)) return false;
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (n.followUpDate && new Date(n.followUpDate) > end) return false;
    }
    return true;
  });
}

export default function Reminders() {
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["followups"],
    queryFn: fetchFollowUps,
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    if (!data) return null;
    const filter = (list: FollowUpNote[]) => applyFilters(list, employeeFilter, startDate, endDate);
    return {
      today: filter(data.today),
      upcoming: filter(data.upcoming),
      missed: filter(data.missed),
      done: filter(data.done),
    };
  }, [data, employeeFilter, startDate, endDate]);

  const hasFilters = !!(employeeFilter || startDate || endDate);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Reminders & Follow-ups</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            Track and action all customer follow-up notes, grouped by customer.
          </p>
        </div>
        <Button
          variant={hasFilters ? "default" : "outline"}
          size="sm"
          onClick={() => setShowFilters((v) => !v)}
        >
          <Filter className="h-4 w-4 mr-1.5" />
          Filters {hasFilters ? `(active)` : ""}
        </Button>
      </div>

      {showFilters && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Employee ID</Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="Filter by employee #"
                  value={employeeFilter}
                  onChange={(e) => setEmployeeFilter(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>From Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>To Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-3"
                onClick={() => { setEmployeeFilter(""); setStartDate(""); setEndDate(""); }}
              >
                Clear filters
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      )}

      {isError && <div className="text-destructive">Failed to load follow-ups.</div>}

      {filtered && (
        <Tabs defaultValue="today">
          <TabsList className="mb-4">
            <TabsTrigger value="today" className="gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Today
              {filtered.today.length > 0 && (
                <span className="ml-1 rounded-full bg-primary text-primary-foreground text-xs px-1.5 py-0.5 font-medium">
                  {filtered.today.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Upcoming
              {filtered.upcoming.length > 0 && (
                <span className="ml-1 rounded-full bg-blue-500 text-white text-xs px-1.5 py-0.5 font-medium">
                  {filtered.upcoming.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="missed" className="gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" />
              Missed
              {filtered.missed.length > 0 && (
                <span className="ml-1 rounded-full bg-destructive text-destructive-foreground text-xs px-1.5 py-0.5 font-medium">
                  {filtered.missed.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="done" className="gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Done
              {filtered.done.length > 0 && (
                <span className="ml-1 rounded-full bg-green-500 text-white text-xs px-1.5 py-0.5 font-medium">
                  {filtered.done.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="today">
            {filtered.today.length === 0 ? <EmptyTab label="today's" /> : <NoteGroupList notes={filtered.today} showMarkDone />}
          </TabsContent>
          <TabsContent value="upcoming">
            {filtered.upcoming.length === 0 ? <EmptyTab label="upcoming" /> : <NoteGroupList notes={filtered.upcoming} showMarkDone />}
          </TabsContent>
          <TabsContent value="missed">
            {filtered.missed.length === 0 ? <EmptyTab label="missed" /> : <NoteGroupList notes={filtered.missed} showMarkDone />}
          </TabsContent>
          <TabsContent value="done">
            {filtered.done.length === 0 ? <EmptyTab label="done" /> : <NoteGroupList notes={filtered.done} />}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
