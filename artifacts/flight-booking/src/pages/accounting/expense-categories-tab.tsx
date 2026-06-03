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
import { Loader2, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

export function ExpenseCategoriesTab() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("general");

  const { data: categories, isLoading } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: async () => {
      const res = await authFetch(`${BASE}/api/accounting/expense-categories`);
      if (!res.ok) throw new Error("Failed to fetch expense categories");
      const data = await res.json();
      return data.expenseCategories as { id: number; name: string; type: string }[];
    }
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`${BASE}/api/accounting/expense-categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type })
      });
      if (!res.ok) throw new Error("Failed to add category");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: language === "ar" ? "تمت الإضافة" : "Added successfully" });
      queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
      setIsAddOpen(false);
      setName("");
      setType("general");
    },
    onError: () => {
      toast({ 
        title: language === "ar" ? "خطأ" : "Error", 
        description: language === "ar" ? "فشل إضافة نوع المصروف" : "Failed to add expense category",
        variant: "destructive" 
      });
    }
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">
          {language === "ar" ? "إدارة أنواع المصروفات" : "Manage Expense Categories"}
        </h2>
        
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4 me-2" />
              {language === "ar" ? "إضافة نوع" : "Add Category"}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{language === "ar" ? "إضافة نوع مصروف جديد" : "Add New Expense Category"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>{language === "ar" ? "اسم النوع" : "Category Name"}</Label>
                <Input value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{language === "ar" ? "التصنيف" : "Type"}</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">{language === "ar" ? "عام" : "General"}</SelectItem>
                    <SelectItem value="marketing">{language === "ar" ? "تسويق" : "Marketing"}</SelectItem>
                    <SelectItem value="operations">{language === "ar" ? "تشغيل" : "Operations"}</SelectItem>
                    <SelectItem value="payroll">{language === "ar" ? "رواتب" : "Payroll"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button 
                className="w-full bg-emerald-600 hover:bg-emerald-700" 
                onClick={() => addMutation.mutate()}
                disabled={!name || addMutation.isPending}
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
              <TableHead>{language === "ar" ? "الاسم" : "Name"}</TableHead>
              <TableHead>{language === "ar" ? "التصنيف" : "Type"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={2} className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-500" />
                </TableCell>
              </TableRow>
            ) : categories?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="text-center py-8 text-muted-foreground">
                  {language === "ar" ? "لا توجد أنواع مصروفات" : "No expense categories found"}
                </TableCell>
              </TableRow>
            ) : (
              categories?.map(cat => (
                <TableRow key={cat.id}>
                  <TableCell className="font-medium">{cat.name}</TableCell>
                  <TableCell className="capitalize">{cat.type}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
