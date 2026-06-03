import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@/lib/api";
import { useLanguage } from "@/contexts/language-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Edit } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

export function PayrollTab() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  
  const currentDate = new Date();
  const [filterMonth, setFilterMonth] = useState((currentDate.getMonth() + 1).toString());
  const [filterYear, setFilterYear] = useState(currentDate.getFullYear().toString());

  const [editingPayroll, setEditingPayroll] = useState<any>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [baseSalary, setBaseSalary] = useState("0");
  const [commissionPercentage, setCommissionPercentage] = useState("0");
  const [commissionEarned, setCommissionEarned] = useState("0");
  const [deductions, setDeductions] = useState("0");
  const [currency, setCurrency] = useState("KWD");
  const [status, setStatus] = useState("pending");

  const netSalary = parseFloat(baseSalary || "0") + parseFloat(commissionEarned || "0") - parseFloat(deductions || "0");

  const { data: employees } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const res = await authFetch(`${BASE}/api/employees`);
      if (!res.ok) throw new Error("Failed to fetch employees");
      const data = await res.json();
      return data.employees as { id: number; name: string; baseSalary: number; commissionPercentage: number }[];
    }
  });

  const { data: payrolls, isLoading } = useQuery({
    queryKey: ["payrolls", filterMonth, filterYear],
    queryFn: async () => {
      const res = await authFetch(`${BASE}/api/accounting/payrolls?month=${filterMonth}&year=${filterYear}`);
      if (!res.ok) throw new Error("Failed to fetch payrolls");
      const data = await res.json();
      return data.payrolls as any[];
    }
  });

  const handleEmployeeChange = (empIdStr: string) => {
    setEmployeeId(empIdStr);
    const emp = employees?.find(e => e.id.toString() === empIdStr);
    if (emp) {
      setBaseSalary((emp.baseSalary || 0).toString());
      setCommissionPercentage((emp.commissionPercentage || 0).toString());
    }
  };

  const openEdit = (p: any) => {
    setEditingPayroll(p);
    setEmployeeId(p.employeeId.toString());
    setBaseSalary(p.baseSalary.toString());
    setCommissionPercentage(p.commissionPercentage.toString());
    setCommissionEarned(p.commissionEarned.toString());
    setDeductions(p.deductions.toString());
    setCurrency(p.currency || "KWD");
    setStatus(p.status);
    setIsAddOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`${BASE}/api/accounting/payrolls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          employeeId: parseInt(employeeId),
          month: parseInt(filterMonth),
          year: parseInt(filterYear),
          baseSalary: parseFloat(baseSalary || "0"),
          commissionPercentage: parseFloat(commissionPercentage || "0"),
          commissionEarned: parseFloat(commissionEarned || "0"),
          deductions: parseFloat(deductions || "0"),
          currency,
          netSalary,
          status,
          paymentDate: status === "paid" ? new Date().toISOString() : null,
        })
      });
      if (!res.ok) throw new Error("Failed to save payroll");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: language === "ar" ? "تم الحفظ" : "Saved successfully" });
      queryClient.invalidateQueries({ queryKey: ["payrolls"] });
      setIsAddOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ 
        title: language === "ar" ? "خطأ" : "Error", 
        description: language === "ar" ? "فشل حفظ الراتب" : "Failed to save payroll",
        variant: "destructive" 
      });
    }
  });

  const resetForm = () => {
    setEditingPayroll(null);
    setEmployeeId("");
    setBaseSalary("0");
    setCommissionPercentage("0");
    setCommissionEarned("0");
    setDeductions("0");
    setCurrency("KWD");
    setStatus("pending");
  };

  const handleOpenChange = (open: boolean) => {
    setIsAddOpen(open);
    if (!open) resetForm();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white dark:bg-card p-3 rounded-lg border">
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <Label>{language === "ar" ? "الشهر" : "Month"}</Label>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <SelectItem key={m} value={m.toString()}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label>{language === "ar" ? "السنة" : "Year"}</Label>
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[currentDate.getFullYear() - 1, currentDate.getFullYear(), currentDate.getFullYear() + 1].map(y => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <Dialog open={isAddOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4 me-2" />
              {language === "ar" ? "إضافة/تعديل راتب موظف" : "Add/Edit Payroll"}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {editingPayroll 
                  ? (language === "ar" ? "تعديل راتب" : "Edit Payroll")
                  : (language === "ar" ? "تسجيل راتب لموظف" : "Record Payroll")}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>{language === "ar" ? "الموظف" : "Employee"}</Label>
                <Select value={employeeId} onValueChange={handleEmployeeChange} disabled={!!editingPayroll}>
                  <SelectTrigger>
                    <SelectValue placeholder={language === "ar" ? "اختر الموظف" : "Select employee"} />
                  </SelectTrigger>
                  <SelectContent>
                    {employees?.map(emp => (
                      <SelectItem key={emp.id} value={emp.id.toString()}>{emp.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === "ar" ? "الراتب الأساسي" : "Base Salary"}</Label>
                  <div className="flex gap-2">
                    <Input className="flex-1" type="number" value={baseSalary} onChange={e => setBaseSalary(e.target.value)} />
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger className="w-[80px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="KWD">KWD</SelectItem>
                        <SelectItem value="EGP">EGP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{language === "ar" ? "الاستقطاعات/خصومات" : "Deductions"}</Label>
                  <Input type="number" value={deductions} onChange={e => setDeductions(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === "ar" ? "نسبة العمولة (%)" : "Commission (%)"}</Label>
                  <Input type="number" value={commissionPercentage} onChange={e => setCommissionPercentage(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{language === "ar" ? "العمولة المكتسبة" : "Commission Earned"}</Label>
                  <Input type="number" value={commissionEarned} onChange={e => setCommissionEarned(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{language === "ar" ? "الحالة" : "Status"}</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">{language === "ar" ? "قيد الانتظار" : "Pending"}</SelectItem>
                    <SelectItem value="paid">{language === "ar" ? "تم الدفع" : "Paid"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="bg-emerald-50 dark:bg-emerald-950 p-4 rounded-lg flex justify-between items-center font-bold">
                <span>{language === "ar" ? "صافي الراتب المستحق:" : "Net Salary Due:"}</span>
                <span className="text-xl text-emerald-600 dark:text-emerald-400">{netSalary} {currency}</span>
              </div>

              <Button 
                className="w-full bg-emerald-600 hover:bg-emerald-700" 
                onClick={() => saveMutation.mutate()}
                disabled={!employeeId || saveMutation.isPending}
              >
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (language === "ar" ? "حفظ" : "Save")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-md bg-white dark:bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>{language === "ar" ? "الموظف" : "Employee"}</TableHead>
              <TableHead>{language === "ar" ? "الراتب الأساسي" : "Base"}</TableHead>
              <TableHead>{language === "ar" ? "العمولة المكتسبة" : "Commission"}</TableHead>
              <TableHead>{language === "ar" ? "استقطاعات" : "Deductions"}</TableHead>
              <TableHead>{language === "ar" ? "الصافي" : "Net Salary"}</TableHead>
              <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-500" />
                </TableCell>
              </TableRow>
            ) : payrolls?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  {language === "ar" ? "لا توجد رواتب مسجلة لهذا الشهر" : "No payrolls recorded for this month"}
                </TableCell>
              </TableRow>
            ) : (
              payrolls?.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.employeeName}</TableCell>
                  <TableCell>{p.baseSalary} {p.currency}</TableCell>
                  <TableCell className="text-emerald-600 dark:text-emerald-400">+{p.commissionEarned} {p.currency}</TableCell>
                  <TableCell className="text-red-600 dark:text-red-400">-{p.deductions} {p.currency}</TableCell>
                  <TableCell className="font-bold">{p.netSalary} {p.currency}</TableCell>
                  <TableCell>
                    <Badge variant={p.status === "paid" ? "default" : "secondary"} className={p.status === "paid" ? "bg-emerald-500" : ""}>
                      {p.status === "paid" 
                        ? (language === "ar" ? "تم الدفع" : "Paid") 
                        : (language === "ar" ? "قيد الانتظار" : "Pending")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
