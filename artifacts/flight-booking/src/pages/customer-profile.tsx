import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation, Link } from "wouter";
import {
  ArrowLeft, Phone, Mail, Globe, MapPin, CreditCard, User, Pencil, Trash2,
  MessageSquare, Plus, Check, Clock, AlertCircle, Ticket, ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { formatShortDate, formatDateTime } from "@/lib/formatters";
import { STATUS_COLORS, STATUS_LABELS, SOURCE_LABELS, CUSTOMER_STATUSES } from "@/lib/customer-constants";
import { CustomerForm } from "@/components/customer-form";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const FOLLOW_UP_STATUS_STYLES: Record<string, { cls: string; label: string; icon: React.ReactNode }> = {
  pending: { cls: "bg-yellow-100 text-yellow-800", label: "Pending", icon: <Clock className="h-3 w-3" /> },
  done: { cls: "bg-green-100 text-green-800", label: "Done", icon: <Check className="h-3 w-3" /> },
  missed: { cls: "bg-red-100 text-red-800", label: "Missed", icon: <AlertCircle className="h-3 w-3" /> },
};

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
}

interface Note {
  id: number;
  customerId: number;
  employeeId: number | null;
  ticketId: number | null;
  note: string;
  followUpDate: string | null;
  followUpStatus: string | null;
  createdAt: string;
  updatedAt: string;
}

async function fetchCustomer(id: number): Promise<{ customer: Customer }> {
  const res = await fetch(`${BASE}/api/customers/${id}`);
  if (!res.ok) throw new Error("Customer not found");
  return res.json();
}

async function fetchNotes(id: number): Promise<{ notes: Note[] }> {
  const res = await fetch(`${BASE}/api/customers/${id}/notes`);
  if (!res.ok) throw new Error("Failed to fetch notes");
  return res.json();
}

async function updateCustomer(id: number, data: Record<string, unknown>): Promise<{ customer: Customer }> {
  const res = await fetch(`${BASE}/api/customers/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to update customer");
  return json;
}

async function deleteCustomer(id: number): Promise<void> {
  const res = await fetch(`${BASE}/api/customers/${id}`, { method: "DELETE" });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to delete customer");
}

async function createNote(
  customerId: number,
  data: { note: string; followUpDate?: string; followUpStatus?: string; ticketId?: number }
): Promise<{ note: Note }> {
  const res = await fetch(`${BASE}/api/customers/${customerId}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to add note");
  return json;
}

async function updateNote(noteId: number, data: { followUpStatus?: string }): Promise<{ note: Note }> {
  const res = await fetch(`${BASE}/api/notes/${noteId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to update note");
  return json;
}

function EditCustomerSheet({ customer, open, onClose }: { customer: Customer; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => updateCustomer(customer.id, data),
    onSuccess: () => {
      toast({ title: "Customer updated" });
      qc.invalidateQueries({ queryKey: ["customer", customer.id] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      onClose();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader><SheetTitle>Edit Customer</SheetTitle></SheetHeader>
        <CustomerForm
          initialValues={{
            fullName: customer.fullName,
            phone: customer.phone ?? "",
            whatsapp: customer.whatsapp ?? "",
            email: customer.email ?? "",
            nationality: customer.nationality ?? "",
            passportNumber: customer.passportNumber ?? "",
            nationalId: customer.nationalId ?? "",
            address: customer.address ?? "",
            source: customer.source ?? "other",
            status: customer.status,
            assignedEmployeeId: customer.assignedEmployeeId?.toString() ?? "",
          }}
          submitLabel="Save Changes"
          isPending={mutation.isPending}
          onSubmit={(data) => mutation.mutate(data)}
          onCancel={onClose}
        />
      </SheetContent>
    </Sheet>
  );
}

function AddNoteForm({
  customerId,
  onSuccess,
  autoFocus,
}: {
  customerId: number;
  onSuccess: () => void;
  autoFocus?: boolean;
}) {
  const [noteText, setNoteText] = useState("");
  const [noteError, setNoteError] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpStatus, setFollowUpStatus] = useState("pending");
  const [ticketId, setTicketId] = useState("");
  const [expanded, setExpanded] = useState(autoFocus ?? false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: { note: string; followUpDate?: string; followUpStatus?: string; ticketId?: number }) =>
      createNote(customerId, data),
    onSuccess: () => {
      toast({ title: "Note added" });
      setNoteText("");
      setFollowUpDate("");
      setFollowUpStatus("pending");
      setTicketId("");
      setExpanded(false);
      qc.invalidateQueries({ queryKey: ["notes", customerId] });
      qc.invalidateQueries({ queryKey: ["customer", customerId] });
      onSuccess();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!noteText.trim()) {
      setNoteError("Note text is required.");
      return;
    }
    setNoteError("");
    const data: { note: string; followUpDate?: string; followUpStatus?: string; ticketId?: number } = {
      note: noteText.trim(),
    };
    if (followUpDate) {
      data.followUpDate = new Date(followUpDate).toISOString();
      data.followUpStatus = followUpStatus;
    }
    if (ticketId) data.ticketId = Number(ticketId);
    mutation.mutate(data);
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full flex items-center gap-2 px-4 py-3 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
      >
        <Plus className="h-4 w-4" /> Add a note...
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="border rounded-lg p-4 space-y-3 bg-muted/20">
      <div className="space-y-1.5">
        <Label>Note *</Label>
        <Textarea
          value={noteText}
          onChange={(e) => { setNoteText(e.target.value); if (noteError) setNoteError(""); }}
          placeholder="Write a note about this customer..."
          rows={3}
          autoFocus
          className={noteError ? "border-destructive focus-visible:ring-destructive" : ""}
        />
        {noteError && <p className="text-xs text-destructive">{noteError}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Follow-up Date</Label>
          <Input
            type="datetime-local"
            value={followUpDate}
            onChange={(e) => setFollowUpDate(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Linked Ticket ID</Label>
          <Input
            type="number"
            min={1}
            value={ticketId}
            onChange={(e) => setTicketId(e.target.value)}
            placeholder="Optional ticket #"
          />
        </div>
      </div>
      {followUpDate && (
        <div className="space-y-1.5">
          <Label>Follow-up Status</Label>
          <Select value={followUpStatus} onValueChange={setFollowUpStatus}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={() => setExpanded(false)}>Cancel</Button>
        <Button type="submit" size="sm" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : "Add Note"}
        </Button>
      </div>
    </form>
  );
}

function NoteCard({ note, customerId }: { note: Note; customerId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const markDone = useMutation({
    mutationFn: () => updateNote(note.id, { followUpStatus: "done" }),
    onSuccess: () => {
      toast({ title: "Follow-up marked as done" });
      qc.invalidateQueries({ queryKey: ["notes", customerId] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const fuStyle = note.followUpStatus ? FOLLOW_UP_STATUS_STYLES[note.followUpStatus] : null;

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
          <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div className="w-px flex-1 bg-border mt-2" />
      </div>
      <div className="flex-1 pb-4">
        <div className="bg-card border rounded-lg p-3 shadow-sm">
          <p className="text-sm whitespace-pre-wrap">{note.note}</p>
          {(note.followUpDate || note.followUpStatus || note.ticketId) && (
            <div className="mt-2 pt-2 border-t space-y-1.5">
              {note.ticketId && (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Ticket className="h-3 w-3" />
                  Linked to Ticket #{note.ticketId}
                </div>
              )}
              {note.followUpDate && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Follow-up: {formatShortDate(note.followUpDate)}
                </div>
              )}
              {fuStyle && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${fuStyle.cls}`}>
                    {fuStyle.icon} {fuStyle.label}
                  </span>
                  {note.followUpStatus === "pending" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-xs px-2"
                      disabled={markDone.isPending}
                      onClick={() => markDone.mutate()}
                    >
                      <Check className="h-3 w-3 mr-1" /> Mark Done
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-1 ml-1 flex items-center gap-2">
          <span>{formatDateTime(note.createdAt)}</span>
          {note.employeeId && <span>· Employee #{note.employeeId}</span>}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, icon }: { label: string; value?: string | null; icon?: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-muted-foreground w-32 flex-shrink-0 flex items-center gap-1">{icon}{label}</span>
      <span className="font-medium break-all">{value}</span>
    </div>
  );
}

export default function CustomerProfile() {
  const [, params] = useRoute("/customers/:id");
  const [, navigate] = useLocation();
  const id = Number(params?.id);

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);

  const notesSectionRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: customerData, isLoading, isError } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => fetchCustomer(id),
    enabled: !isNaN(id),
  });

  const { data: notesData, isLoading: notesLoading } = useQuery({
    queryKey: ["notes", id],
    queryFn: () => fetchNotes(id),
    enabled: !isNaN(id),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => updateCustomer(id, { status }),
    onSuccess: () => {
      toast({ title: "Status updated" });
      qc.invalidateQueries({ queryKey: ["customer", id] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      setChangingStatus(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteCustomer(id),
    onSuccess: () => {
      toast({ title: "Customer deleted" });
      qc.invalidateQueries({ queryKey: ["customers"] });
      navigate("/customers");
    },
    onError: (e: Error) => {
      toast({ title: "Cannot delete", description: e.message, variant: "destructive" });
      setDeleteOpen(false);
    },
  });

  function handleAddNote() {
    setShowAddNote(true);
    setTimeout(() => notesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  }

  if (isNaN(id)) {
    return <div className="text-destructive">Invalid customer ID.</div>;
  }

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-3xl">
        <Skeleton className="h-8 w-48" />
        <Card><CardContent className="p-6 space-y-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
        </CardContent></Card>
      </div>
    );
  }

  if (isError || !customerData) {
    return <div className="text-destructive">Customer not found.</div>;
  }

  const c = customerData.customer;
  const notes = notesData?.notes ?? [];

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/customers">
          <Button variant="ghost" size="sm" className="flex items-center gap-1.5 -ml-2">
            <ArrowLeft className="h-4 w-4" /> Customers
          </Button>
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 text-xl font-bold"
            style={{ background: "linear-gradient(135deg, #d4af37 0%, #f5d76e 50%, #d4af37 100%)", color: "#022c22" }}>
            {c.fullName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{c.fullName}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {changingStatus ? (
                <>
                  <Select
                    defaultValue={c.status}
                    onValueChange={(v) => statusMutation.mutate(v)}
                    disabled={statusMutation.isPending}
                  >
                    <SelectTrigger className="h-7 text-xs w-36 px-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CUSTOMER_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setChangingStatus(false)}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[c.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {STATUS_LABELS[c.status] ?? c.status}
                  </span>
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
                    onClick={() => setChangingStatus(true)}
                  >
                    Change Status
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {c.phone && (
            <a href={`tel:${c.phone}`}>
              <Button variant="outline" size="sm" className="flex items-center gap-1.5">
                <Phone className="h-4 w-4" /> Call
              </Button>
            </a>
          )}
          {(c.whatsapp || c.phone) && (
            <a
              href={`https://wa.me/${(c.whatsapp || c.phone)!.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm" className="flex items-center gap-1.5 text-green-700 border-green-300 hover:bg-green-50">
                <ExternalLink className="h-4 w-4" /> WhatsApp
              </Button>
            </a>
          )}
          <Button variant="outline" size="sm" className="flex items-center gap-1.5" onClick={handleAddNote}>
            <MessageSquare className="h-4 w-4" /> Add Note
          </Button>
          <Link href={`/tickets/new?customerId=${c.id}`}>
            <Button variant="outline" size="sm" className="flex items-center gap-1.5">
              <Ticket className="h-4 w-4" /> Add Ticket
            </Button>
          </Link>
          <Button variant="outline" size="sm" className="flex items-center gap-1.5" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
          <Button
            variant="outline" size="sm"
            className="flex items-center gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      {/* Info Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" /> Customer Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            <InfoRow label="Phone" value={c.phone} icon={<Phone className="h-3.5 w-3.5" />} />
            <InfoRow label="WhatsApp" value={c.whatsapp} icon={<Phone className="h-3.5 w-3.5" />} />
            <InfoRow label="Email" value={c.email} icon={<Mail className="h-3.5 w-3.5" />} />
            <InfoRow label="Nationality" value={c.nationality} icon={<Globe className="h-3.5 w-3.5" />} />
            <InfoRow label="Passport No." value={c.passportNumber} icon={<CreditCard className="h-3.5 w-3.5" />} />
            <InfoRow label="National ID" value={c.nationalId} icon={<CreditCard className="h-3.5 w-3.5" />} />
            <InfoRow label="Address" value={c.address} icon={<MapPin className="h-3.5 w-3.5" />} />
            <InfoRow label="Source" value={c.source ? (SOURCE_LABELS[c.source] ?? c.source) : null} />
            <InfoRow label="Assigned Emp." value={c.assignedEmployeeId ? `Employee #${c.assignedEmployeeId}` : null} />
            <InfoRow label="Added" value={formatShortDate(c.createdAt)} />
            {c.lastContactedAt && <InfoRow label="Last Contact" value={formatShortDate(c.lastContactedAt)} />}
          </div>
        </CardContent>
      </Card>

      {/* Notes Section */}
      <div className="space-y-4" ref={notesSectionRef}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="h-5 w-5" /> Notes
            {notes.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground">({notes.length})</span>
            )}
          </h2>
        </div>

        <AddNoteForm customerId={id} onSuccess={() => setShowAddNote(false)} autoFocus={showAddNote} key={showAddNote ? "expanded" : "collapsed"} />

        {notesLoading && (
          <div className="space-y-4 mt-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
                <Skeleton className="h-20 flex-1 rounded-lg" />
              </div>
            ))}
          </div>
        )}

        {!notesLoading && notes.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm border rounded-lg border-dashed">
            No notes yet. Add the first note above.
          </div>
        )}

        {!notesLoading && notes.length > 0 && (
          <div className="mt-4">
            {notes.map((n) => (
              <NoteCard key={n.id} note={n} customerId={id} />
            ))}
          </div>
        )}
      </div>

      {editOpen && (
        <EditCustomerSheet customer={c} open={editOpen} onClose={() => setEditOpen(false)} />
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{c.fullName}</strong>? This action cannot be undone.
              Customers with existing tickets cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Customer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
