import React, { useState, useMemo, useCallback } from "react";
import { Layout } from "@/components/layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck,
  Plus,
  Search,
  Calendar as CalendarIcon,
  Clock,
  User,
  FileText,
  Printer,
  Trash2,
  Filter,
  CheckCircle2,
  XCircle,
  Clock3,
  Pencil,
} from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "../../contexts/language-context";
import { authFetch, BASE } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/page-header";

// --- API Helpers ---
async function fetchAttendance(): Promise<{ attendance: Attendance[] }> {
  const res = await authFetch(`${BASE}/api/hr/attendance`);
  if (!res.ok) throw new Error("Failed to fetch attendance");
  return res.json();
}

async function saveAttendance(data: any): Promise<{ attendance: Attendance }> {
  const res = await authFetch(`${BASE}/api/hr/attendance`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to save attendance");
  return json;
}

async function deleteAttendance(id: number): Promise<void> {
  const res = await authFetch(`${BASE}/api/hr/attendance/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete attendance");
}

async function fetchLeaves(): Promise<{ leaves: Leave[] }> {
  const res = await authFetch(`${BASE}/api/hr/leaves`);
  if (!res.ok) throw new Error("Failed to fetch leaves");
  return res.json();
}

async function saveLeave(data: any): Promise<{ leave: Leave }> {
  const res = await authFetch(`${BASE}/api/hr/leaves`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to save leave");
  return json;
}

async function deleteLeave(id: number): Promise<void> {
  const res = await authFetch(`${BASE}/api/hr/leaves/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete leave");
}

async function fetchHREmployees(): Promise<{ employees: Employee[] }> {
  const res = await authFetch(`${BASE}/api/hr/employees`);
  if (!res.ok) throw new Error("Failed to fetch employees");
  return res.json();
}

// --- Types ---
interface Employee {
  id: number;
  name: string;
  initials: string;
}

interface Attendance {
  id: number;
  employeeId: number;
  employeeName: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
  notes: string | null;
}

interface Leave {
  id: number;
  employeeId: number;
  employeeName: string;
  type: string;
  startDate: string;
  endDate: string;
  status: string;
  reason: string | null;
}

// --- Page Component ---
export default function HRManagement() {
  const [activeTab, setActiveTab] = useState("attendance");
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();

  // Fetch only Employee+HR roles (excludes Administrator/Supervisor)
  const { data: hrEmployeesData } = useQuery<{ employees: Employee[] }>({
    queryKey: ["/api/hr/employees"],
    queryFn: fetchHREmployees,
  });
  const employees = hrEmployeesData?.employees || [];

  // Queries
  const { data: attendanceData, isLoading: isLoadingAttendance } = useQuery<{ attendance: Attendance[] }>({
    queryKey: ["/api/hr/attendance"],
    queryFn: fetchAttendance,
  });

  const { data: leavesData, isLoading: isLoadingLeaves } = useQuery<{ leaves: Leave[] }>({
    queryKey: ["/api/hr/leaves"],
    queryFn: fetchLeaves,
  });

  const attendance = attendanceData?.attendance || [];
  const leaves = leavesData?.leaves || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title={t("hr.title")}
        description={t("hr.subtitle")}
        icon={ShieldCheck}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-white dark:bg-muted border border-border p-1 mb-6 rounded-full inline-flex">
          <TabsTrigger value="attendance" className="flex items-center gap-2 rounded-full px-6 data-[state=active]:bg-primary data-[state=active]:text-white">
            <Clock className="h-4 w-4" />
            {t("dashboard.attendanceRecords")}
          </TabsTrigger>
          <TabsTrigger value="leaves" className="flex items-center gap-2 rounded-full px-6 data-[state=active]:bg-primary data-[state=active]:text-white">
            <CalendarIcon className="h-4 w-4" />
            {t("dashboard.leaveRequests")}
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2 rounded-full px-6 data-[state=active]:bg-primary data-[state=active]:text-white">
            <FileText className="h-4 w-4" />
            {t("dashboard.hrReports")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="attendance">
          <AttendanceTab employees={employees} attendance={attendance} />
        </TabsContent>

        <TabsContent value="leaves">
          <LeavesTab employees={employees} leaves={leaves} />
        </TabsContent>

        <TabsContent value="reports">
          <ReportsTab employees={employees} attendance={attendance} leaves={leaves} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// --- Attendance Tab ---
function AttendanceTab({ employees, attendance }: { employees: Employee[]; attendance: Attendance[] }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Attendance | null>(null);
  const [search, setSearch] = useState("");
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const openAddDialog = () => {
    setEditingRecord(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (record: Attendance) => {
    setEditingRecord(record);
    setIsDialogOpen(true);
  };

  const mutation = useMutation({
    mutationFn: (data: any) => saveAttendance(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/attendance"] });
      setIsDialogOpen(false);
      toast({ title: t("common.success"), description: language === "ar" ? "تم حفظ سجل الحضور بنجاح" : "Attendance record saved." });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: t("common.error"), description: err.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteAttendance(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/attendance"] });
      toast({ title: language === "ar" ? "تم الحذف" : "Deleted", description: language === "ar" ? "تم حذف السجل بنجاح." : "Record removed successfully." });
    },
  });

  const filtered = useMemo(() => {
    return attendance.filter(a => 
      a.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      a.date.includes(search)
    );
  }, [attendance, search]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      employeeId: parseInt(formData.get("employeeId") as string),
      date: formData.get("date"),
      checkIn: formData.get("checkIn") || null,
      checkOut: formData.get("checkOut") || null,
      status: formData.get("status"),
      notes: formData.get("notes"),
    };
    mutation.mutate(data);
  };

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
        <div>
          <CardTitle>{t("dashboard.attendanceRecords")}</CardTitle>
          <CardDescription>{language === "ar" ? "تسجيل الحضور والانصراف اليومي للموظفين يدوياً." : "Manual check-in/out logging for employees."}</CardDescription>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAddDialog} className="bg-primary hover:bg-primary/90 text-white rounded-full px-6">
              <Plus className="h-4 w-4 mr-2 rtl:mr-0 rtl:ml-2" />
              {language === "ar" ? "إضافة سجل" : "Add Record"}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editingRecord ? (language === "ar" ? "تعديل سجل الحضور" : "Edit Attendance Record") : (language === "ar" ? "إضافة سجل حضور يدوياً" : "Add Attendance Record")}</DialogTitle>
                <DialogDescription>
                  {editingRecord ? (language === "ar" ? "تحديث تفاصيل حضور وانصراف الموظف." : "Update employee attendance details.") : (language === "ar" ? "تسجيل حضور يدوياً لأحد الموظفين بالنظام." : "Manually log attendance for an employee.")}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 text-start">
                <div className="grid gap-2">
                  <Label htmlFor="employeeId">{t("reports.table.employee")}</Label>
                  <Select name="employeeId" required defaultValue={editingRecord?.employeeId.toString()}>
                    <SelectTrigger className="rounded-full">
                      <SelectValue placeholder={t("ticketForm.selectCustomer")} />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map(emp => (
                        <SelectItem key={emp.id} value={emp.id.toString()}>{emp.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="date">{t("common.date")}</Label>
                  <Input id="date" name="date" type="date" required className="rounded-full" defaultValue={editingRecord?.date || format(new Date(), "yyyy-MM-dd")} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="checkIn">{t("hr.table.checkInTime")}</Label>
                    <Input id="checkIn" name="checkIn" type="time" className="rounded-full" defaultValue={editingRecord?.checkIn || ""} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="checkOut">{t("hr.table.checkOutTime")}</Label>
                    <Input id="checkOut" name="checkOut" type="time" className="rounded-full" defaultValue={editingRecord?.checkOut || ""} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="status">{t("common.status")}</Label>
                  <Select name="status" defaultValue={editingRecord?.status || "Present"}>
                    <SelectTrigger className="rounded-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Present">{language === "ar" ? "حاضر" : "Present"}</SelectItem>
                      <SelectItem value="Absent">{language === "ar" ? "غائب" : "Absent"}</SelectItem>
                      <SelectItem value="Late">{language === "ar" ? "متأخر" : "Late"}</SelectItem>
                      <SelectItem value="Half Day">{language === "ar" ? "نصف يوم" : "Half Day"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="notes">{t("ticketDetail.notes")}</Label>
                  <Input id="notes" name="notes" placeholder={t("employees.pinPlaceholderEdit")} className="rounded-full" defaultValue={editingRecord?.notes || ""} />
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>{t("common.cancel")}</Button>
                <Button type="submit" className="bg-primary text-white" disabled={mutation.isPending}>
                  {mutation.isPending ? t("employees.saving") : t("common.save")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={language === "ar" ? "ابحث بالاسم أو التاريخ..." : "Search by name or date..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rtl:pl-3 rtl:pr-9 rounded-full bg-muted/50 border-none"
            />
          </div>
        </div>

        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent">
                <TableHead>{t("reports.table.employee")}</TableHead>
                <TableHead>{t("hr.table.date")}</TableHead>
                <TableHead>{t("hr.table.checkInTime")}</TableHead>
                <TableHead>{t("hr.table.checkOutTime")}</TableHead>
                <TableHead>{t("hr.table.status")}</TableHead>
                <TableHead className="text-end">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {language === "ar" ? "لم يتم العثور على سجلات حضور." : "No attendance records found."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((record) => (
                  <TableRow key={record.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-semibold text-primary">{record.employeeName}</TableCell>
                    <TableCell>{record.date}</TableCell>
                    <TableCell>{record.checkIn || "-"}</TableCell>
                    <TableCell>{record.checkOut || "-"}</TableCell>
                    <TableCell>
                      <StatusBadge status={record.status} />
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full"
                          onClick={() => openEditDialog(record)}
                          title={t("common.edit")}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                          onClick={() => {
                            if (confirm(language === "ar" ? "هل أنت متأكد من حذف هذا السجل؟" : "Are you sure you want to delete this record?")) {
                              deleteMutation.mutate(record.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Leaves Tab ---
function LeavesTab({ employees, leaves }: { employees: Employee[]; leaves: Leave[] }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: (data: any) => saveLeave(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/leaves"] });
      setIsDialogOpen(false);
      toast({ title: t("common.success"), description: language === "ar" ? "تم تسجيل الإجازة بنجاح." : "Leave record saved." });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: t("common.error"), description: err.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteLeave(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/leaves"] });
      toast({ title: language === "ar" ? "تم الحذف" : "Deleted", description: language === "ar" ? "تم حذف الإجازة بنجاح." : "Leave record removed." });
    },
  });

  const filtered = useMemo(() => {
    return leaves.filter(l => 
      l.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      l.type.toLowerCase().includes(search.toLowerCase())
    );
  }, [leaves, search]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      employeeId: parseInt(formData.get("employeeId") as string),
      type: formData.get("type"),
      startDate: formData.get("startDate"),
      endDate: formData.get("endDate"),
      reason: formData.get("reason"),
      status: "Approved",
    };
    mutation.mutate(data);
  };

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
        <div>
          <CardTitle>{t("hr.leavesTab")}</CardTitle>
          <CardDescription>{language === "ar" ? "تتبع ومراجعة إجازات الموظفين وصلاحياتها." : "Track and approve employee leaves."}</CardDescription>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-white rounded-full px-6">
              <Plus className="h-4 w-4 mr-2 rtl:mr-0 rtl:ml-2" />
              {t("hr.newLeaveRequest")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{t("hr.newLeaveRequest")}</DialogTitle>
                <DialogDescription>{language === "ar" ? "إدخال طلب إجازة يدوياً لأحد الموظفين." : "Manually enter a leave record for an employee."}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 text-start">
                <div className="grid gap-2">
                  <Label htmlFor="employeeId">{t("reports.table.employee")}</Label>
                  <Select name="employeeId" required>
                    <SelectTrigger className="rounded-full">
                      <SelectValue placeholder={t("ticketForm.selectCustomer")} />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map(emp => (
                        <SelectItem key={emp.id} value={emp.id.toString()}>{emp.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="type">{t("hr.leaveType")}</Label>
                  <Select name="type" defaultValue="Annual">
                    <SelectTrigger className="rounded-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Annual">{language === "ar" ? "إجازة سنوية" : "Annual Leave"}</SelectItem>
                      <SelectItem value="Sick">{language === "ar" ? "إجازة مرضية" : "Sick Leave"}</SelectItem>
                      <SelectItem value="Unpaid">{language === "ar" ? "إجازة بدون راتب" : "Unpaid Leave"}</SelectItem>
                      <SelectItem value="Emergency">{language === "ar" ? "إجازة اضطرارية" : "Emergency Leave"}</SelectItem>
                      <SelectItem value="Maternity/Paternity">{language === "ar" ? "إجازة أمومة/أبوة" : "Maternity/Paternity"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="startDate">{t("hr.startDate")}</Label>
                    <Input id="startDate" name="startDate" type="date" required className="rounded-full" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="endDate">{t("hr.endDate")}</Label>
                    <Input id="endDate" name="endDate" type="date" required className="rounded-full" />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="reason">{t("hr.reason")}</Label>
                  <Input id="reason" name="reason" placeholder={language === "ar" ? "سبب مختصر" : "Brief reason"} className="rounded-full" />
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>{t("common.cancel")}</Button>
                <Button type="submit" className="bg-primary text-white" disabled={mutation.isPending}>
                  {mutation.isPending ? t("employees.saving") : t("common.save")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={language === "ar" ? "ابحث بالموظف أو النوع..." : "Search by employee or type..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rtl:pl-3 rtl:pr-9 rounded-full bg-muted/50 border-none"
            />
          </div>
        </div>

        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent">
                <TableHead>{t("reports.table.employee")}</TableHead>
                <TableHead>{t("hr.leaveType")}</TableHead>
                <TableHead>{t("hr.startDate")}</TableHead>
                <TableHead>{t("hr.endDate")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead className="text-end">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {language === "ar" ? "لم يتم العثور على طلبات إجازة." : "No leave records found."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((leave) => (
                  <TableRow key={leave.id} className="hover:bg-muted/30">
                    <TableCell className="font-semibold text-primary">{leave.employeeName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="rounded-full font-normal">
                        {leave.type}
                      </Badge>
                    </TableCell>
                    <TableCell>{leave.startDate}</TableCell>
                    <TableCell>{leave.endDate}</TableCell>
                    <TableCell>
                      <Badge className="bg-green-500/10 text-green-600 border-none rounded-full px-3">
                        {language === "ar" ? "موافق عليها" : leave.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                        onClick={() => {
                          if (confirm(language === "ar" ? "هل أنت متأكد من حذف سجل الإجازة هذا؟" : "Delete this leave record?")) {
                            deleteMutation.mutate(leave.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Reports Tab ---
function ReportsTab({ employees, attendance, leaves }: { employees: Employee[]; attendance: Attendance[]; leaves: Leave[] }) {
  const { t, language } = useLanguage();
  const [dateRange, setDateRange] = useState({
    from: format(startOfMonth(new Date()), "yyyy-MM-dd"),
    to: format(endOfMonth(new Date()), "yyyy-MM-dd"),
  });
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("all");

  const handlePrint = () => {
    const empName = selectedEmployeeId === "all" ? (language === "ar" ? "جميع الموظفين" : "All Employees") : employees.find(e => e.id.toString() === selectedEmployeeId)?.name || "";
    const reportTitle = `HR Report - ${empName} (${dateRange.from} to ${dateRange.to})`;
    
    const filteredAttendance = attendance.filter(a => {
      const matchEmp = selectedEmployeeId === "all" || a.employeeId.toString() === selectedEmployeeId;
      const matchDate = a.date >= dateRange.from && a.date <= dateRange.to;
      return matchEmp && matchDate;
    });

    const filteredLeaves = leaves.filter(l => {
      const matchEmp = selectedEmployeeId === "all" || l.employeeId.toString() === selectedEmployeeId;
      const matchDate = (l.startDate >= dateRange.from && l.startDate <= dateRange.to) || 
                      (l.endDate >= dateRange.from && l.endDate <= dateRange.to);
      return matchEmp && matchDate;
    });

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const isArReport = language === "ar";

    const html = `
      <!DOCTYPE html>
      <html dir="${isArReport ? 'rtl' : 'ltr'}">
      <head>
        <title>${reportTitle}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #333; line-height: 1.6; }
          .header { border-bottom: 2px solid #1e40af; padding-bottom: 20px; margin-bottom: 30px; text-align: center; }
          h1 { margin: 0; color: #1e40af; }
          .meta { margin-top: 10px; color: #666; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: ${isArReport ? 'right' : 'left'}; }
          th { background: #f8fafc; font-weight: bold; color: #1e40af; }
          .section-title { font-size: 18px; font-weight: bold; margin: 20px 0 10px; color: #1e40af; border-${isArReport ? 'right' : 'left'}: 4px solid #10b981; padding-${isArReport ? 'right' : 'left'}: 10px; }
          .badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; }
          .badge-present { background: #dcfce7; color: #166534; }
          .badge-absent { background: #fee2e2; color: #991b1b; }
          @media print {
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${isArReport ? "تقرير سجلات الحضور والإجازات" : "Attendance and Leave Report"}</h1>
          <div class="meta">
            ${isArReport ? `الفترة: من ${dateRange.from} إلى ${dateRange.to} | الموظف: ${empName}` : `Period: ${dateRange.from} to ${dateRange.to} | Employee: ${empName}`}
          </div>
        </div>

        <div class="section-title">${isArReport ? "سجل الحضور والغياب" : "Attendance Log"}</div>
        <table>
          <thead>
            <tr>
              <th>${isArReport ? "الموظف" : "Employee"}</th>
              <th>${isArReport ? "التاريخ" : "Date"}</th>
              <th>${isArReport ? "ساعة الحضور" : "Check In"}</th>
              <th>${isArReport ? "ساعة الانصراف" : "Check Out"}</th>
              <th>${isArReport ? "الحالة" : "Status"}</th>
            </tr>
          </thead>
          <tbody>
            ${filteredAttendance.map(a => `
              <tr>
                <td>${a.employeeName}</td>
                <td>${a.date}</td>
                <td>${a.checkIn || '-'}</td>
                <td>${a.checkOut || '-'}</td>
                <td><span class="badge ${a.status === 'Present' ? 'badge-present' : 'badge-absent'}">${isArReport && a.status === 'Present' ? 'حاضر' : a.status}</span></td>
              </tr>
            `).join('')}
            ${filteredAttendance.length === 0 ? `<tr><td colspan="5" style="text-align:center">${isArReport ? "لا توجد بيانات متاحة" : "No data found"}</td></tr>` : ''}
          </tbody>
        </table>

        <div class="section-title">${isArReport ? "سجل الإجازات" : "Leave Log"}</div>
        <table>
          <thead>
            <tr>
              <th>${isArReport ? "الموظف" : "Employee"}</th>
              <th>${isArReport ? "نوع الإجازة" : "Type"}</th>
              <th>${isArReport ? "تاريخ البدء" : "Start Date"}</th>
              <th>${isArReport ? "تاريخ الانتهاء" : "End Date"}</th>
              <th>${isArReport ? "الحالة" : "Status"}</th>
            </tr>
          </thead>
          <tbody>
            ${filteredLeaves.map(l => `
              <tr>
                <td>${l.employeeName}</td>
                <td>${l.type}</td>
                <td>${l.startDate}</td>
                <td>${l.endDate}</td>
                <td>${isArReport && l.status === 'Approved' ? 'موافق عليها' : l.status}</td>
              </tr>
            `).join('')}
            ${filteredLeaves.length === 0 ? `<tr><td colspan="5" style="text-align:center">${isArReport ? "لا توجد بيانات متاحة" : "No data found"}</td></tr>` : ''}
          </tbody>
        </table>

        <div style="margin-top: 50px; border-top: 1px solid #ddd; padding-top: 20px; font-size: 12px; color: #999;">
          ${isArReport ? "تاريخ الطباعة:" : "Printed on:"} ${new Date().toLocaleString()}
        </div>

        <script>
          window.onload = () => {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card className="border-border shadow-sm h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" />
            {language === "ar" ? "خيارات التقرير" : "Report Filters"}
          </CardTitle>
          <CardDescription>{language === "ar" ? "تصدير وطباعة تقارير الموظفين المخصصة." : "Generate customized HR reports."}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-start">
          <div className="grid gap-2">
            <Label htmlFor="repEmployee">{t("reports.table.employee")}</Label>
            <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
              <SelectTrigger className="rounded-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{language === "ar" ? "جميع الموظفين" : "All Employees"}</SelectItem>
                {employees.map(emp => (
                  <SelectItem key={emp.id} value={emp.id.toString()}>{emp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>{t("hr.startDate")}</Label>
            <Input 
              type="date" 
              value={dateRange.from} 
              onChange={e => setDateRange(prev => ({ ...prev, from: e.target.value }))}
              className="rounded-full" 
            />
          </div>
          <div className="grid gap-2">
            <Label>{t("hr.endDate")}</Label>
            <Input 
              type="date" 
              value={dateRange.to} 
              onChange={e => setDateRange(prev => ({ ...prev, to: e.target.value }))}
              className="rounded-full" 
            />
          </div>
          <Separator />
          <Button className="w-full bg-primary text-white rounded-full" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2 rtl:mr-0 rtl:ml-2" />
            {language === "ar" ? "تصدير وطباعة" : "Export & Print"}
          </Button>
        </CardContent>
      </Card>

      <Card className="md:col-span-2 border-border shadow-sm">
        <CardHeader>
          <CardTitle>{language === "ar" ? "معاينة التقرير" : "Report Preview"}</CardTitle>
          <CardDescription>{language === "ar" ? "عرض سريع للبيانات المحددة التي سيتم تصديرها بالتقرير." : "Quick view of the data that will be in the report."}</CardDescription>
        </CardHeader>
        <CardContent>
           <div className="space-y-6 text-start">
             <div>
                <h4 className="text-sm font-semibold text-primary mb-3 uppercase tracking-wider">{language === "ar" ? "ملخص الحضور" : "Attendance Summary"}</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted/50 p-4 rounded-2xl border border-border">
                    <p className="text-muted-foreground text-xs">{language === "ar" ? "إجمالي السجلات" : "Total Records"}</p>
                    <p className="text-2xl font-bold text-primary">
                      {attendance.filter(a => (selectedEmployeeId === 'all' || a.employeeId.toString() === selectedEmployeeId) && a.date >= dateRange.from && a.date <= dateRange.to).length}
                    </p>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-2xl border border-border">
                    <p className="text-muted-foreground text-xs">{language === "ar" ? "عدد أيام الحضور" : "Presents"}</p>
                    <p className="text-2xl font-bold text-emerald-600">
                      {attendance.filter(a => (selectedEmployeeId === 'all' || a.employeeId.toString() === selectedEmployeeId) && a.date >= dateRange.from && a.date <= dateRange.to && a.status === 'Present').length}
                    </p>
                  </div>
                </div>
             </div>
             <div>
                <h4 className="text-sm font-semibold text-primary mb-3 uppercase tracking-wider">{language === "ar" ? "ملخص الإجازات" : "Leave Summary"}</h4>
                <div className="bg-muted/50 p-4 rounded-2xl border border-border">
                    <p className="text-muted-foreground text-xs">{language === "ar" ? "إجمالي أيام الإجازات" : "Total Leave Days"}</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {leaves.filter(l => (selectedEmployeeId === 'all' || l.employeeId.toString() === selectedEmployeeId) && ((l.startDate >= dateRange.from && l.startDate <= dateRange.to) || (l.endDate >= dateRange.from && l.endDate <= dateRange.to))).length}
                    </p>
                </div>
             </div>
           </div>
        </CardContent>
      </Card>
    </div>
  );
}

// --- Helper Components ---
function StatusBadge({ status }: { status: string }) {
  const { language } = useLanguage();
  switch (status) {
    case "Present":
      return (
        <Badge className="bg-emerald-500/10 text-emerald-600 border-none flex items-center gap-1 w-fit rounded-full px-3 font-normal">
          <CheckCircle2 className="h-3 w-3" />
          {language === "ar" ? "حاضر" : "Present"}
        </Badge>
      );
    case "Absent":
      return (
        <Badge className="bg-red-500/10 text-red-600 border-none flex items-center gap-1 w-fit rounded-full px-3 font-normal">
          <XCircle className="h-3 w-3" />
          {language === "ar" ? "غائب" : "Absent"}
        </Badge>
      );
    case "Late":
      return (
        <Badge className="bg-amber-500/10 text-amber-600 border-none flex items-center gap-1 w-fit rounded-full px-3 font-normal">
          <Clock3 className="h-3 w-3" />
          {language === "ar" ? "متأخر" : "Late"}
        </Badge>
      );
    case "Half Day":
      return (
        <Badge className="bg-blue-500/10 text-blue-600 border-none flex items-center gap-1 w-fit rounded-full px-3 font-normal">
          {language === "ar" ? "نصف يوم" : "Half Day"}
        </Badge>
      );
    default:
      return <Badge variant="outline" className="rounded-full font-normal">{status}</Badge>;
  }
}
