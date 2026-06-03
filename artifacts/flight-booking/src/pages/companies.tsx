import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Building2, Plus, Pencil, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/language-context";
import { authFetch } from "@/lib/api";
import { PageHeader } from "@/components/page-header";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Company {
  id: number;
  name: string;
  createdAt: string;
}

interface Branch {
  id: number;
  name: string;
  companyId: number;
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompanySheet, setShowCompanySheet] = useState(false);
  const [showBranchSheet, setShowBranchSheet] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const { toast } = useToast();
  const { t, language } = useLanguage();

  async function loadData() {
    setLoading(true);
    try {
      const [compRes, branchRes] = await Promise.all([
        authFetch(`${BASE}/api/companies`),
        authFetch(`${BASE}/api/branches`),
      ]);
      if (compRes.ok) {
        const data = await compRes.json();
        setCompanies(data.companies || []);
      }
      if (branchRes.ok) {
        const data = await branchRes.json();
        setBranches(data.branches || []);
      }
    } catch (err) {
      toast({ title: t("common.error"), description: "Failed to load data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const companyMutation = useMutation({
    mutationFn: async (name: string) => {
      const url = editingCompany ? `${BASE}/api/companies/${editingCompany.id}` : `${BASE}/api/companies`;
      const res = await authFetch(url, {
        method: editingCompany ? "PUT" : "POST",
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Failed to save company");
    },
    onSuccess: () => {
      toast({ title: editingCompany ? (language === "ar" ? "تم تحديث بيانات الشركة" : "Company updated") : (language === "ar" ? "تم إنشاء الشركة بنجاح" : "Company created") });
      setShowCompanySheet(false);
      loadData();
    },
    onError: (e: Error) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  const branchMutation = useMutation({
    mutationFn: async (data: { name: string; companyId: number }) => {
      const url = editingBranch ? `${BASE}/api/branches/${editingBranch.id}` : `${BASE}/api/branches`;
      const res = await authFetch(url, {
        method: editingBranch ? "PUT" : "POST",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save branch");
    },
    onSuccess: () => {
      toast({ title: editingBranch ? (language === "ar" ? "تم تحديث بيانات الفرع" : "Branch updated") : (language === "ar" ? "تم إنشاء الفرع بنجاح" : "Branch created") });
      setShowBranchSheet(false);
      loadData();
    },
    onError: (e: Error) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("common.companies")}
        description={language === "ar" ? "إدارة فروع وشركات الوكالة المتعاقدة بالنظام." : "Manage organizational structure and office locations."}
        icon={Building2}
        actions={
          <Button onClick={() => { setEditingCompany(null); setShowCompanySheet(true); }} className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> {language === "ar" ? "إضافة شركة" : "Add Company"}
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-start">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" /> {language === "ar" ? "الشركات" : "Companies"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {companies.map((company) => (
              <div 
                key={company.id} 
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${selectedCompanyId === company.id ? 'bg-primary/5 border-primary' : 'hover:bg-muted'}`}
                onClick={() => setSelectedCompanyId(company.id)}
              >
                <span className="font-medium">{company.name}</span>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setEditingCompany(company); setShowCompanySheet(true); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 flex-wrap gap-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" /> {language === "ar" ? "الفروع" : "Branches"}
            </CardTitle>
            <Button 
              size="sm" 
              variant="outline" 
              disabled={!selectedCompanyId}
              onClick={() => { setEditingBranch(null); setShowBranchSheet(true); }}
              className="h-8"
            >
              <Plus className="h-3.5 w-3.5 me-1" /> {language === "ar" ? "إضافة فرع" : "Add Branch"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {!selectedCompanyId ? (
              <p className="text-sm text-muted-foreground italic text-center py-8">{language === "ar" ? "اختر شركة من القائمة لعرض الفروع التابعة لها." : "Select a company to see its branches."}</p>
            ) : (
              branches.filter(b => b.companyId === selectedCompanyId).length === 0 ? (
                <p className="text-sm text-muted-foreground italic text-center py-8">{language === "ar" ? "لا توجد فروع مسجلة لهذه الشركة بعد." : "No branches found for this company."}</p>
              ) : (
                branches.filter(b => b.companyId === selectedCompanyId).map((branch) => (
                  <div key={branch.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <span className="font-medium">{branch.name}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingBranch(branch); setShowBranchSheet(true); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))
              )
            )}
          </CardContent>
        </Card>
      </div>

      <CompanySheet 
        open={showCompanySheet} 
        editing={editingCompany} 
        onClose={() => setShowCompanySheet(false)} 
        onSubmit={(name: string) => companyMutation.mutate(name)}
        isPending={companyMutation.isPending}
      />

      <BranchSheet 
        open={showBranchSheet} 
        editing={editingBranch} 
        companyId={selectedCompanyId!}
        onClose={() => setShowBranchSheet(false)} 
        onSubmit={(name: string) => branchMutation.mutate({ name, companyId: selectedCompanyId! })}
        isPending={branchMutation.isPending}
      />
    </div>
  );
}

function CompanySheet({ open, editing, onClose, onSubmit, isPending }: any) {
  const [name, setName] = useState("");
  const { t, language } = useLanguage();
  useEffect(() => {
    if (open) setName(editing?.name || "");
  }, [open, editing]);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{editing ? (language === "ar" ? "تعديل الشركة" : "Edit Company") : (language === "ar" ? "إضافة شركة" : "Add Company")}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 py-4 text-start">
          <div className="space-y-1.5">
            <Label>{language === "ar" ? "اسم الشركة" : "Company Name"}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. ABC Travel" />
          </div>
          <Button className="w-full" disabled={isPending || !name.trim()} onClick={() => onSubmit(name)}>
            {isPending ? t("employees.saving") : (language === "ar" ? "حفظ بيانات الشركة" : "Save Company")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function BranchSheet({ open, editing, companyId, onClose, onSubmit, isPending }: any) {
  const [name, setName] = useState("");
  const { t, language } = useLanguage();
  useEffect(() => {
    if (open) setName(editing?.name || "");
  }, [open, editing]);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{editing ? (language === "ar" ? "تعديل الفرع" : "Edit Branch") : (language === "ar" ? "إضافة فرع" : "Add Branch")}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 py-4 text-start">
          <div className="space-y-1.5">
            <Label>{language === "ar" ? "اسم الفرع" : "Branch Name"}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cairo Office" />
          </div>
          <Button className="w-full" disabled={isPending || !name.trim()} onClick={() => onSubmit(name)}>
            {isPending ? t("employees.saving") : (language === "ar" ? "حفظ بيانات الفرع" : "Save Branch")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
