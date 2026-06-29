import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Server, Power, RefreshCw, Trash2, Shield, QrCode } from "lucide-react";
import { useLanguage } from "@/contexts/language-context";
import { useEmployee } from "@/contexts/employee-context";
import { authFetch, BASE } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export default function WhatsappAdmin() {
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const { currentEmployee } = useEmployee();
  
  const [newInstanceName, setNewInstanceName] = useState("");
  const [newEmployeeId, setNewEmployeeId] = useState("");
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [currentQr, setCurrentQr] = useState<string | null>(null);

  // ── Fetch Instances ──────────────────────────────────────────────────────────
  const { data: instancesData, isLoading } = useQuery({
    queryKey: ["whatsapp-admin-instances"],
    queryFn: async () => {
      const res = await authFetch(`${BASE}/api/whatsapp/admin/instances`);
      if (!res.ok) throw new Error("Failed to fetch instances");
      return res.json() as Promise<{ instances: any[] }>;
    },
    refetchInterval: 5000, // auto-refresh to show connecting state
  });

  // ── Fetch Employees for Dropdown ─────────────────────────────────────────────
  const { data: employeesData } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const res = await authFetch(`${BASE}/api/employees`);
      if (!res.ok) throw new Error("Failed to fetch employees");
      return res.json() as Promise<{ employees: any[] }>;
    },
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createInstanceMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`${BASE}/api/whatsapp/admin/instances`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceName: newInstanceName,
          employeeId: parseInt(newEmployeeId),
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as any).message || "Failed to create instance");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: language === "ar" ? "✅ تم الإنشاء بنجاح" : "✅ Instance created!" });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-admin-instances"] });
      setNewInstanceName("");
      setNewEmployeeId("");
    },
    onError: (err: any) => {
      toast({ title: language === "ar" ? "خطأ في الإنشاء" : "Error creating", description: err.message, variant: "destructive" });
    },
  });

  const deleteInstanceMutation = useMutation({
    mutationFn: async (instanceName: string) => {
      const res = await authFetch(`${BASE}/api/whatsapp/admin/instances/${instanceName}`, { method: "DELETE" });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as any).message || "Failed to delete");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: language === "ar" ? "🗑 تم החذف" : "🗑 Instance deleted" });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-admin-instances"] });
    },
    onError: (err: any) => {
      toast({ title: language === "ar" ? "خطأ في الحذف" : "Error deleting", description: err.message, variant: "destructive" });
    },
  });

  const restartInstanceMutation = useMutation({
    mutationFn: async (instanceName: string) => {
      const res = await authFetch(`${BASE}/api/whatsapp/admin/instances/${instanceName}/restart`, { method: "POST" });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as any).message || "Failed to restart");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: language === "ar" ? "🔄 تم إعادة التشغيل" : "🔄 Instance restarted" });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-admin-instances"] });
    },
    onError: (err: any) => {
      toast({ title: language === "ar" ? "خطأ في إعادة التشغيل" : "Error restarting", description: err.message, variant: "destructive" });
    },
  });

  const logoutInstanceMutation = useMutation({
    mutationFn: async (instanceName: string) => {
      const res = await authFetch(`${BASE}/api/whatsapp/admin/instances/${instanceName}/disconnect`, { method: "POST" });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as any).message || "Failed to logout");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: language === "ar" ? "🔌 تم تسجيل الخروج" : "🔌 Instance disconnected" });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-admin-instances"] });
    },
    onError: (err: any) => {
      toast({ title: language === "ar" ? "خطأ في تسجيل الخروج" : "Error disconnecting", description: err.message, variant: "destructive" });
    },
  });

  const connectInstanceMutation = useMutation({
    mutationFn: async (instanceName: string) => {
      const res = await authFetch(`${BASE}/api/whatsapp/admin/instances/${instanceName}/connect`, { method: "POST" });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as any).message || "Failed to connect");
      }
      return res.json();
    },
    onSuccess: (data) => {
      if (data?.qrcode?.base64) {
        setCurrentQr(data.qrcode.base64);
        setQrDialogOpen(true);
      } else {
        toast({ title: language === "ar" ? "ℹ️ جارٍ الاتصال" : "ℹ️ Connecting" });
      }
      queryClient.invalidateQueries({ queryKey: ["whatsapp-admin-instances"] });
    },
    onError: (err: any) => {
      toast({ title: language === "ar" ? "خطأ في الاتصال" : "Connection Error", description: err.message, variant: "destructive" });
    },
  });

  if (currentEmployee?.role !== "Administrator") {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <h2 className="text-2xl font-bold">{language === "ar" ? "غير مصرح" : "Unauthorized"}</h2>
        <p>{language === "ar" ? "هذه الصفحة للمشرفين فقط." : "Admin access only."}</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      
      {/* ── Header Card ── */}
      <Card className="bg-card border-border shadow-sm text-start bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl text-foreground">
            <Server className="h-6 w-6 text-primary" />
            {language === "ar" ? "إدارة سيرفرات الواتساب (Evolution API)" : "WhatsApp Servers Admin (Evolution API)"}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {language === "ar" 
              ? "تحكم كامل في جميع الجلسات، إنشاء، حذف، إعادة تشغيل، وعرض رموز QR مباشرة." 
              : "Full control over all instances: create, delete, restart, and view QR codes directly."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          
          <div className="flex flex-col sm:flex-row gap-3 items-end p-4 rounded-lg border border-border bg-background shadow-sm">
            <div className="w-full sm:flex-1 space-y-1.5">
              <label className="text-sm font-medium">{language === "ar" ? "اسم الجلسة (Instance Name)" : "Instance Name"}</label>
              <Input
                type="text"
                placeholder="e.g. emp_1"
                value={newInstanceName}
                onChange={(e) => setNewInstanceName(e.target.value)}
                dir="ltr"
              />
            </div>
            <div className="w-full sm:flex-1 space-y-1.5">
              <label className="text-sm font-medium">{language === "ar" ? "ربط بالموظف" : "Link to Employee"}</label>
              <Select value={newEmployeeId} onValueChange={setNewEmployeeId}>
                <SelectTrigger>
                  <SelectValue placeholder={language === "ar" ? "اختر الموظف" : "Select employee"} />
                </SelectTrigger>
                <SelectContent>
                  {employeesData?.employees?.map(emp => (
                    <SelectItem key={emp.id} value={emp.id.toString()}>{emp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => createInstanceMutation.mutate()}
              disabled={!newInstanceName || !newEmployeeId || createInstanceMutation.isPending}
              className="w-full sm:w-auto bg-primary text-primary-foreground"
            >
              {createInstanceMutation.isPending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Power className="me-2 h-4 w-4" />}
              {language === "ar" ? "إنشاء جلسة جديدة" : "Create Instance"}
            </Button>
          </div>

        </CardContent>
      </Card>

      {/* ── Instances List ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : instancesData?.instances?.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-xl">
            <Server className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>{language === "ar" ? "لا توجد جلسات حالياً." : "No instances found."}</p>
          </div>
        ) : (
          instancesData?.instances?.map(inst => {
            const isLive = inst.liveStatus === "open" || inst.connectionStatus === "open";
            const isConnecting = inst.liveStatus === "connecting" || inst.connectionStatus === "connecting";
            
            return (
              <Card key={inst.id} className="shadow-sm border-border">
                <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg font-mono" dir="ltr">{inst.instanceName}</CardTitle>
                      <CardDescription className="mt-1 flex items-center gap-1.5">
                        <span className="font-semibold text-foreground">{inst.employeeName}</span>
                      </CardDescription>
                    </div>
                    <div className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                      isLive ? "bg-emerald-100 text-emerald-700" :
                      isConnecting ? "bg-yellow-100 text-yellow-700" :
                      "bg-destructive/10 text-destructive"
                    }`}>
                      {isLive ? (language === "ar" ? "متصل" : "Online") :
                       isConnecting ? (language === "ar" ? "جارٍ الاتصال..." : "Connecting...") :
                       (language === "ar" ? "مفصول" : "Offline")}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  
                  {/* Meta */}
                  <div className="space-y-1 text-sm text-muted-foreground">
                    {inst.phoneNumber && (
                      <p className="flex justify-between">
                        <span>{language === "ar" ? "رقم الهاتف:" : "Phone:"}</span>
                        <span className="font-mono text-foreground" dir="ltr">{inst.phoneNumber}</span>
                      </p>
                    )}
                    {inst.profileName && (
                      <p className="flex justify-between">
                        <span>{language === "ar" ? "الاسم:" : "Name:"}</span>
                        <span className="font-medium text-foreground">{inst.profileName}</span>
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-2 gap-2">
                    {!isLive && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100"
                        onClick={() => connectInstanceMutation.mutate(inst.instanceName)}
                        disabled={connectInstanceMutation.isPending}
                      >
                        <QrCode className="me-2 h-4 w-4" />
                        {language === "ar" ? "عرض QR" : "Show QR"}
                      </Button>
                    )}
                    
                    {isLive && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100"
                        onClick={() => {
                          if(confirm(language === "ar" ? "تسجيل الخروج سيقطع الاتصال، متأكد؟" : "Logout will disconnect, sure?")) {
                            logoutInstanceMutation.mutate(inst.instanceName);
                          }
                        }}
                        disabled={logoutInstanceMutation.isPending}
                      >
                        <Power className="me-2 h-4 w-4" />
                        {language === "ar" ? "تسجيل خروج" : "Logout"}
                      </Button>
                    )}

                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      onClick={() => restartInstanceMutation.mutate(inst.instanceName)}
                      disabled={restartInstanceMutation.isPending}
                    >
                      <RefreshCw className={`me-2 h-4 w-4 ${restartInstanceMutation.isPending ? "animate-spin" : ""}`} />
                      {language === "ar" ? "إعادة تشغيل" : "Restart"}
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full col-span-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => {
                        if(confirm(language === "ar" ? "تحذير: سيتم حذف الجلسة نهائياً من السيرفر. هل أنت متأكد؟" : "WARNING: Instance will be permanently deleted. Sure?")) {
                          deleteInstanceMutation.mutate(inst.instanceName);
                        }
                      }}
                      disabled={deleteInstanceMutation.isPending}
                    >
                      <Trash2 className="me-2 h-4 w-4" />
                      {language === "ar" ? "حذف الجلسة نهائياً" : "Delete Instance Permanently"}
                    </Button>
                  </div>

                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="sm:max-w-md flex flex-col items-center">
          <DialogHeader>
            <DialogTitle className="text-center">{language === "ar" ? "امسح رمز الاستجابة السريعة" : "Scan QR Code"}</DialogTitle>
            <DialogDescription className="text-center">
              {language === "ar" ? "افتح تطبيق الواتساب ← الأجهزة المرتبطة ← امسح الرمز" : "Open WhatsApp → Linked Devices → Scan QR Code"}
            </DialogDescription>
          </DialogHeader>
          <div className="relative bg-white p-4 rounded-xl inline-block border border-border my-4">
            {currentQr ? (
              <img src={currentQr} alt="QR Code" className="w-64 h-64 mx-auto" />
            ) : (
              <div className="w-64 h-64 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
          <Button onClick={() => setQrDialogOpen(false)} variant="outline" className="w-full">
            {language === "ar" ? "إغلاق" : "Close"}
          </Button>
        </DialogContent>
      </Dialog>

    </div>
  );
}
