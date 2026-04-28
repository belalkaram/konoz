import { useState, useEffect, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Users, Plus, Pencil, UserX, UserCheck, Tag, ShieldAlert, LogOut, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useEmployee, useCurrentEmployee } from "@/contexts/employee-context";
import { authFetch } from "@/lib/api";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface EmployeeRow {
  id: number;
  name: string;
  initials: string;
  role: string;
  username: string;
  isActive: boolean;
  activeCustomers?: number;
  openTickets?: number;
}

interface EmployeeFormData {
  name: string;
  initials: string;
  role: string;
  username: string;
  pin: string;
}

const EMPTY_FORM: EmployeeFormData = {
  name: "",
  initials: "",
  role: "Agent",
  username: "",
  pin: "",
};

interface ActiveSession {
  token: string;
  employeeId: number;
  name: string;
  role: string;
  createdAt: string;
  expiresAt: number;
}

async function fetchActiveSessions(): Promise<ActiveSession[]> {
  const res = await authFetch(`${BASE}/api/admin/sessions`);
  if (!res.ok) throw new Error("Failed to fetch sessions");
  const data = await res.json() as { sessions: ActiveSession[] };
  return data.sessions;
}

async function revokeSession(token: string): Promise<void> {
  const res = await authFetch(`${BASE}/api/admin/sessions/${encodeURIComponent(token)}`, { method: "DELETE" });
  const json = await res.json();
  if (!res.ok) throw new Error((json as { message?: string }).message || "Failed to revoke session");
}

async function fetchAllEmployees(): Promise<EmployeeRow[]> {
  const res = await fetch(`${BASE}/api/employees?includeInactive=true`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch employees");
  const data = await res.json() as { employees: EmployeeRow[] };
  return data.employees;
}

async function createEmployee(data: EmployeeFormData): Promise<void> {
  const res = await authFetch(`${BASE}/api/employees`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error((json as { message?: string }).message || "Failed to create employee");
}

async function updateEmployee(id: number, data: Partial<EmployeeFormData>): Promise<void> {
  const res = await authFetch(`${BASE}/api/employees/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error((json as { message?: string }).message || "Failed to update employee");
}

async function deactivateEmployee(id: number): Promise<void> {
  const res = await authFetch(`${BASE}/api/employees/${id}/deactivate`, { method: "PATCH" });
  const json = await res.json();
  if (!res.ok) throw new Error((json as { message?: string }).message || "Failed to deactivate employee");
}

async function activateEmployee(id: number): Promise<void> {
  const res = await authFetch(`${BASE}/api/employees/${id}/activate`, { method: "PATCH" });
  const json = await res.json();
  if (!res.ok) throw new Error((json as { message?: string }).message || "Failed to activate employee");
}

function autoInitials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

interface EmployeeFormSheetProps {
  open: boolean;
  editing: EmployeeRow | null;
  onClose: () => void;
  onSuccess: () => void;
}

function EmployeeFormSheet({ open, editing, onClose, onSuccess }: EmployeeFormSheetProps) {
  const [form, setForm] = useState<EmployeeFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<EmployeeFormData>>({});
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      if (editing) {
        setForm({ name: editing.name, initials: editing.initials, role: editing.role, username: editing.username, pin: "" });
      } else {
        setForm(EMPTY_FORM);
      }
      setErrors({});
    }
  }, [open, editing]);

  function set(field: keyof EmployeeFormData, val: string) {
    const update: Partial<EmployeeFormData> = { [field]: val };
    if (field === "name" && !editing) {
      update.initials = autoInitials(val);
    }
    setForm((f) => ({ ...f, ...update }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: "" }));
  }

  function validate(): boolean {
    const errs: Partial<EmployeeFormData> = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (!form.initials.trim()) errs.initials = "Initials are required";
    if (!form.username.trim()) errs.username = "Username is required";
    else if (!/^[a-z0-9_]+$/.test(form.username)) errs.username = "Lowercase letters, numbers, underscores only";
    if (!editing && !form.pin) errs.pin = "PIN is required for new employees";
    else if (form.pin && (form.pin.length < 4 || !/^\d+$/.test(form.pin))) errs.pin = "PIN must be 4–8 digits";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        const payload: Partial<EmployeeFormData> = { name: form.name, initials: form.initials, role: form.role, username: form.username };
        if (form.pin) payload.pin = form.pin;
        await updateEmployee(editing.id, payload);
      } else {
        await createEmployee(form);
      }
    },
    onSuccess: () => {
      toast({ title: editing ? "Employee updated" : "Employee added" });
      onSuccess();
      onClose();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    mutation.mutate();
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{editing ? "Edit Employee" : "Add Employee"}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-1.5">
            <Label>Full Name *</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Sara Ahmed" />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Initials *</Label>
              <Input value={form.initials} onChange={(e) => set("initials", e.target.value.toUpperCase())} placeholder="SA" maxLength={4} />
              {errors.initials && <p className="text-xs text-destructive">{errors.initials}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Role *</Label>
              <Select value={form.role} onValueChange={(v) => set("role", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Agent">Agent</SelectItem>
                  <SelectItem value="Administrator">Administrator</SelectItem>
                  <SelectItem value="Supervisor">Supervisor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Username *</Label>
            <Input value={form.username} onChange={(e) => set("username", e.target.value.toLowerCase())} placeholder="sara.ahmed" />
            {errors.username && <p className="text-xs text-destructive">{errors.username}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>{editing ? "New PIN (leave blank to keep current)" : "PIN *"}</Label>
            <Input
              type="password"
              inputMode="numeric"
              value={form.pin}
              onChange={(e) => set("pin", e.target.value)}
              placeholder={editing ? "Enter new PIN to change" : "4–8 digit PIN"}
              maxLength={8}
            />
            {errors.pin && <p className="text-xs text-destructive">{errors.pin}</p>}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Saving..." : editing ? "Save Changes" : "Add Employee"}</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export default function EmployeesPage() {
  const { employees, refreshEmployees } = useEmployee();
  const currentEmployee = useCurrentEmployee();
  const [, navigate] = useLocation();
  const [showSheet, setShowSheet] = useState(false);
  const [editing, setEditing] = useState<EmployeeRow | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<EmployeeRow | null>(null);
  const [allEmployees, setAllEmployees] = useState<EmployeeRow[] | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[] | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState<ActiveSession | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const isAdmin = currentEmployee.role === "Administrator";

  async function loadAll() {
    try {
      const rows = await fetchAllEmployees();
      setAllEmployees(rows);
    } catch {
    }
  }

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const rows = await fetchActiveSessions();
      setActiveSessions(rows);
    } catch {
      toast({ title: "Error", description: "Failed to load sessions", variant: "destructive" });
    } finally {
      setSessionsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (isAdmin) {
      loadAll();
      loadSessions();
    }
  }, [isAdmin]);

  function handleToggleShowInactive(show: boolean) {
    setShowInactive(show);
    if (show && !allEmployees) {
      loadAll();
    }
  }

  const displayEmployees: EmployeeRow[] = showInactive
    ? (allEmployees ?? [])
    : (allEmployees ? allEmployees.filter((e) => e.isActive) : employees as EmployeeRow[]);

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => deactivateEmployee(id),
    onSuccess: async () => {
      toast({ title: "Employee deactivated" });
      await refreshEmployees();
      await loadAll();
      qc.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const activateMutation = useMutation({
    mutationFn: (id: number) => activateEmployee(id),
    onSuccess: async () => {
      toast({ title: "Employee activated" });
      await refreshEmployees();
      await loadAll();
      qc.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const revokeSessionMutation = useMutation({
    mutationFn: (token: string) => revokeSession(token),
    onSuccess: async () => {
      toast({ title: "Session revoked", description: "The user has been logged out." });
      await loadSessions();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  async function handleFormSuccess() {
    await refreshEmployees();
    await loadAll();
    qc.invalidateQueries({ queryKey: ["employees"] });
  }

  function openAdd() {
    setEditing(null);
    setShowSheet(true);
  }

  function openEdit(emp: EmployeeRow) {
    setEditing(emp);
    setShowSheet(true);
  }

  useEffect(() => {
    if (!isAdmin) {
      navigate("/");
    }
  }, [isAdmin, navigate]);

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Employees</h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage your team members and their access.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showInactive ? "default" : "outline"}
            size="sm"
            onClick={() => handleToggleShowInactive(!showInactive)}
          >
            {showInactive ? "Hide Inactive" : "Show Inactive"}
          </Button>
          <Button onClick={openAdd} className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add Employee
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-muted-foreground font-medium">
            {displayEmployees.length} {showInactive ? "total" : "active"} employee{displayEmployees.length !== 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {displayEmployees.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p>No employees found.</p>
            </div>
          ) : (
            <div>
              {displayEmployees.map((emp) => (
                <div
                  key={emp.id}
                  className={`flex items-center gap-4 px-6 py-4 border-b last:border-0 ${!emp.isActive ? "opacity-50" : ""}`}
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{ background: "linear-gradient(135deg, #d4af37 0%, #f5d76e 50%, #d4af37 100%)", color: "#022c22" }}>
                    {emp.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm flex items-center gap-2">
                      {emp.name}
                      {!emp.isActive && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Inactive</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{emp.role} · @{emp.username}</div>
                  </div>
                  {emp.activeCustomers !== undefined && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => navigate(`/customers?assignedEmployeeId=${emp.id}`)}
                        title="Active customers"
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900 transition-colors font-medium"
                      >
                        <Users className="h-3 w-3" />
                        {emp.activeCustomers}
                      </button>
                      <button
                        onClick={() => navigate(`/tickets?employeeId=${emp.id}`)}
                        title="Open tickets"
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300 dark:hover:bg-amber-900 transition-colors font-medium"
                      >
                        <Tag className="h-3 w-3" />
                        {emp.openTickets}
                      </button>
                    </div>
                  )}
                  {emp.id !== currentEmployee.id ? (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Edit"
                        onClick={() => openEdit(emp)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {emp.isActive ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Deactivate"
                          onClick={() => setConfirmDeactivate(emp)}
                          className="text-destructive hover:text-destructive"
                        >
                          <UserX className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Reactivate"
                          onClick={() => activateMutation.mutate(emp.id)}
                          className="text-emerald-600 hover:text-emerald-700"
                        >
                          <UserCheck className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground px-2 py-1 rounded-full bg-muted">You</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-muted-foreground" />
              Active Sessions
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadSessions}
              disabled={sessionsLoading}
              className="flex items-center gap-1.5 text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${sessionsLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {activeSessions === null || sessionsLoading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Loading sessions…</div>
          ) : activeSessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">No active sessions found.</div>
          ) : (
            <div>
              {activeSessions.map((session) => {
                const isCurrentSession = session.employeeId === currentEmployee.id;
                const loginTime = new Date(session.createdAt);
                const expiresTime = new Date(session.expiresAt);
                return (
                  <div
                    key={session.token}
                    className="flex items-center gap-4 px-6 py-3 border-b last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm flex items-center gap-2">
                        {session.name}
                        {isCurrentSession && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{session.role}</div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground flex-shrink-0 hidden sm:block">
                      <div>Logged in {loginTime.toLocaleString()}</div>
                      <div>Expires {expiresTime.toLocaleString()}</div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Force logout"
                      onClick={() => setConfirmRevoke(session)}
                      className="flex items-center gap-1.5 text-xs text-destructive hover:text-destructive flex-shrink-0"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Revoke
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <EmployeeFormSheet
        open={showSheet}
        editing={editing}
        onClose={() => setShowSheet(false)}
        onSuccess={handleFormSuccess}
      />

      <Dialog open={!!confirmRevoke} onOpenChange={(o) => { if (!o) setConfirmRevoke(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Session</DialogTitle>
            <DialogDescription>
              This will immediately log out <strong>{confirmRevoke?.name}</strong>. They will need to sign in again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRevoke(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={revokeSessionMutation.isPending}
              onClick={() => {
                if (confirmRevoke) {
                  revokeSessionMutation.mutate(confirmRevoke.token);
                  setConfirmRevoke(null);
                }
              }}
            >
              {revokeSessionMutation.isPending ? "Revoking…" : "Force Logout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDeactivate} onOpenChange={(o) => { if (!o) setConfirmDeactivate(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Employee</DialogTitle>
            <DialogDescription>
              This will prevent <strong>{confirmDeactivate?.name}</strong> from logging in. You can reactivate them at any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeactivate(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deactivateMutation.isPending}
              onClick={() => {
                if (confirmDeactivate) {
                  deactivateMutation.mutate(confirmDeactivate.id);
                  setConfirmDeactivate(null);
                }
              }}
            >
              {deactivateMutation.isPending ? "Deactivating..." : "Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
