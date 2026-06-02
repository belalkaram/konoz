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
import { Loader2, Plus, CalendarIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

export function ExpensesTab() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [currency, setCurrency] = useState("KWD");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState("");

  const { data: categories } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: async () => {
      const res = await authFetch(`${BASE}/api/accounting/expense-categories`);
      if (!res.ok) throw new Error("Failed to fetch expense categories");
      const data = await res.json();
      return data.expenseCategories as { id: number; name: string }[];
    }
  });

  const { data: expenses, isLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const res = await authFetch(`${BASE}/api/accounting/expenses`);
      if (!res.ok) throw new Error("Failed to fetch expenses");
      const data = await res.json();
      return data.expenses as any[];
    }
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`${BASE}/api/accounting/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          amount: parseFloat(amount), 
          currency,
          categoryId: parseInt(categoryId), 
          date, 
          description 
        })
      });
      if (!res.ok) throw new Error("Failed to add expense");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: language === "ar" ? "تمت الإضافة" : "Added successfully" });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setIsAddOpen(false);
      setAmount("");
      setCategoryId("");
      setCurrency("KWD");
      setDescription("");
      setDate(new Date().toISOString().split('T')[0]);
    },
    onError: () => {
      toast({ 
        title: language === "ar" ? "خطأ" : "Error", 
        description: language === "ar" ? "فشل إضافة المصروف" : "Failed to add expense",
        variant: "destructive" 
      });
    }
  });

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return format(d, "PPP", { locale: language === "ar" ? ar : undefined });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">
          {language === "ar" ? "سجل المصروفات" : "Expenses Ledger"}
        </h2>
        
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4 mr-2 rtl:ml-2 rtl:mr-0" />
              {language === "ar" ? "إضافة مصروف" : "Add Expense"}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{language === "ar" ? "تسجيل مصروف جديد" : "Record New Expense"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === "ar" ? "المبلغ" : "Amount"}</Label>
                  <div className="flex gap-2">
                    <Input className="flex-1" type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger className="w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="KWD">{language === "ar" ? "دينار" : "KWD"}</SelectItem>
                        <SelectItem value="EGP">{language === "ar" ? "جنيه" : "EGP"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{language === "ar" ? "التاريخ" : "Date"}</Label>
                  <div className="relative">
                    <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{language === "ar" ? "نوع المصروف" : "Category"}</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder={language === "ar" ? "اختر النوع" : "Select category"} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map(c => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{language === "ar" ? "البيان / الوصف" : "Description"}</Label>
                <Input value={description} onChange={e => setDescription(e.target.value)} />
              </div>
              <Button 
                className="w-full bg-emerald-600 hover:bg-emerald-700" 
                onClick={() => addMutation.mutate()}
                disabled={!amount || !categoryId || !date || addMutation.isPending}
              >
                {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (language === "ar" ? "حفظ" : "Save")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{language === "ar" ? "التاريخ" : "Date"}</TableHead>
              <TableHead>{language === "ar" ? "النوع" : "Category"}</TableHead>
              <TableHead>{language === "ar" ? "البيان" : "Description"}</TableHead>
              <TableHead>{language === "ar" ? "المبلغ" : "Amount"}</TableHead>
              <TableHead>{language === "ar" ? "بواسطة" : "Created By"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-500" />
                </TableCell>
              </TableRow>
            ) : expenses?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  {language === "ar" ? "لا توجد مصروفات" : "No expenses found"}
                </TableCell>
              </TableRow>
            ) : (
              expenses?.map(exp => (
                <TableRow key={exp.id}>
                  <TableCell className="whitespace-nowrap">{formatDate(exp.date)}</TableCell>
                  <TableCell>{exp.categoryName}</TableCell>
                  <TableCell>{exp.description || "-"}</TableCell>
                  <TableCell className="font-bold text-red-600 dark:text-red-400">
                    {exp.amount} {exp.currency}
                  </TableCell>
                  <TableCell>{exp.creatorName}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
