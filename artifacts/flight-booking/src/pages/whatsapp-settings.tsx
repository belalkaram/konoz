import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, QrCode, LogOut, CheckCircle2, RefreshCw, BrainCircuit, Key, Eye, EyeOff, ShieldCheck, Target, Bell, Users, UserPlus, Trash2 } from "lucide-react";
import { useLanguage } from "@/contexts/language-context";
import { useEmployee } from "@/contexts/employee-context";
import { authFetch, BASE } from "@/lib/api";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const QR_LIFETIME_SECONDS = 55; // Refresh just before 60s expiry

export default function WhatsappSettings() {
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const { currentEmployee } = useEmployee();
  const isAdmin = currentEmployee?.role === "Administrator";

  // Gemini key state
  const [geminiKey, setGeminiKey] = useState("");
  const [showGeminiKey, setShowGeminiKey] = useState(false);

  const [isPolling, setIsPolling] = useState(false);
  const [qrCountdown, setQrCountdown] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoRefreshRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch instance state ──────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ["whatsapp-instance"],
    queryFn: async () => {
      const res = await authFetch(`${BASE}/api/whatsapp/instance`);
      if (!res.ok) throw new Error("Failed to fetch instance");
      return res.json() as Promise<{ instanceName: string; status: string; qrCode: string | null; isMainInstance?: boolean }>;
    },
    refetchInterval: isPolling ? 3000 : false,
  });

  // ── Fetch Gemini key status (admin only) ──────────────────────────────────
  const { data: geminiStatus, isLoading: geminiLoading } = useQuery({
    queryKey: ["gemini-settings"],
    queryFn: async () => {
      const res = await authFetch(`${BASE}/api/settings/gemini`);
      if (!res.ok) throw new Error("Failed to fetch Gemini settings");
      return res.json() as Promise<{ hasKey: boolean }>;
    },
  });

  // ── Fetch Target Progress (All Roles) ──────────────────────────────────────
  const { data: targetProgress } = useQuery({
    queryKey: ["target-progress"],
    queryFn: async () => {
      const res = await authFetch(`${BASE}/api/settings/target-progress`);
      if (!res.ok) throw new Error("Failed to fetch target progress");
      return res.json() as Promise<{
        monthlyTarget: number;
        totalAchieved: number;
        percentage: number;
        remaining: number;
      }>;
    },
  });

  // ── Notification Settings states (Admin only) ──────────────────────────────
  const [enabledCustomer, setEnabledCustomer] = useState(false);
  const [enabledTicket, setEnabledTicket] = useState(false);
  const [recipientType, setRecipientType] = useState<"main" | "custom">("main");
  const [customNumber, setCustomNumber] = useState("");
  const [monthlyTarget, setMonthlyTarget] = useState(0);

  // ── Fetch Notification Settings (Admin only) ────────────────────────────────
  const { data: notifSettings, isLoading: notifLoading } = useQuery({
    queryKey: ["whatsapp-notifications-settings"],
    queryFn: async () => {
      const res = await authFetch(`${BASE}/api/settings/whatsapp-notifications`);
      if (!res.ok) throw new Error("Failed to fetch notification settings");
      return res.json() as Promise<{
        enabledCustomer: boolean;
        enabledTicket: boolean;
        recipientType: "main" | "custom";
        customNumber: string;
        monthlyTarget: number;
      }>;
    },
  });

  // Sync settings states when fetched
  useEffect(() => {
    if (notifSettings) {
      setEnabledCustomer(notifSettings.enabledCustomer);
      setEnabledTicket(notifSettings.enabledTicket);
      setRecipientType(notifSettings.recipientType);
      setCustomNumber(notifSettings.customNumber);
      setMonthlyTarget(notifSettings.monthlyTarget);
    }
  }, [notifSettings]);

  // ── Routing Agents (Targets) State & Queries ──────────────────────────────
  const [newAgentEmployeeId, setNewAgentEmployeeId] = useState("");
  const [newAgentPhone, setNewAgentPhone] = useState("");

  const { data: routingAgents, isLoading: agentsLoading } = useQuery({
    queryKey: ["whatsapp-routing-agents"],
    queryFn: async () => {
      const res = await authFetch(`${BASE}/api/whatsapp/routing/agents`);
      if (!res.ok) throw new Error("Failed to fetch routing agents");
      return res.json() as Promise<{ agents: any[] }>;
    },
  });

  const { data: employeesData } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const res = await authFetch(`${BASE}/api/employees`);
      if (!res.ok) throw new Error("Failed to fetch employees");
      return res.json() as Promise<{ employees: any[] }>;
    },
  });

  const addAgentMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`${BASE}/api/whatsapp/routing/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: parseInt(newAgentEmployeeId), agentPhone: newAgentPhone }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as any).message || "Failed to add agent");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: language === "ar" ? "✅ تم إضافة الموظف للتوزيع بنجاح" : "✅ Routing agent added!" });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-routing-agents"] });
      setNewAgentEmployeeId("");
      setNewAgentPhone("");
    },
    onError: (err: any) => {
      toast({ title: language === "ar" ? "خطأ في الإضافة" : "Add Error", description: err.message, variant: "destructive" });
    },
  });

  const toggleAgentMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number, isActive: boolean }) => {
      const res = await authFetch(`${BASE}/api/whatsapp/routing/agents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-routing-agents"] });
    },
  });

  const deleteAgentMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await authFetch(`${BASE}/api/whatsapp/routing/agents/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: language === "ar" ? "🗑 تم الحذف بنجاح" : "🗑 Agent removed" });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-routing-agents"] });
    },
  });

  // Save Settings Mutation
  const saveNotifSettingsMutation = useMutation({
    mutationFn: async (settings: {
      enabledCustomer: boolean;
      enabledTicket: boolean;
      recipientType: "main" | "custom";
      customNumber: string;
      monthlyTarget: number;
    }) => {
      const res = await authFetch(`${BASE}/api/settings/whatsapp-notifications`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as any).message || "Failed to save settings");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: language === "ar" ? "✅ تم حفظ إعدادات الإشعارات بنجاح" : "✅ Notification settings saved!" });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-notifications-settings"] });
      queryClient.invalidateQueries({ queryKey: ["target-progress"] });
    },
    onError: (err: any) => {
      toast({ title: language === "ar" ? "خطأ في حفظ الإعدادات" : "Save Error", description: err.message, variant: "destructive" });
    },
  });

  // ── Stop polling once connected ───────────────────────────────────────────
  useEffect(() => {
    if (isPolling && data?.status === "open") {
      setIsPolling(false);
      stopCountdown();
      toast({ title: language === "ar" ? "✅ تم ربط الواتساب بنجاح!" : "✅ Connected to WhatsApp successfully!" });
    }
  }, [data?.status, isPolling, language]);

  // ── Countdown helpers ─────────────────────────────────────────────────────
  const stopCountdown = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (autoRefreshRef.current) clearTimeout(autoRefreshRef.current);
    countdownRef.current = null;
    autoRefreshRef.current = null;
    setQrCountdown(null);
  }, []);

  const startCountdown = useCallback(() => {
    stopCountdown();
    setQrCountdown(QR_LIFETIME_SECONDS);

    countdownRef.current = setInterval(() => {
      setQrCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(countdownRef.current!);
          countdownRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Auto-regenerate a couple of seconds before expiry
    autoRefreshRef.current = setTimeout(() => {
      refreshQR();
    }, (QR_LIFETIME_SECONDS - 2) * 1000);
  }, [stopCountdown]);

  // Cleanup on unmount
  useEffect(() => () => stopCountdown(), [stopCountdown]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const connectMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`${BASE}/api/whatsapp/instance/connect`, { method: "POST" });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as any).message || "Failed to connect");
      }
      return res.json();
    },
    onSuccess: () => {
      setIsPolling(true);
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instance"] });
      startCountdown();
    },
    onError: (err: any) => {
      toast({ title: language === "ar" ? "خطأ في الاتصال" : "Connection Error", description: err.message, variant: "destructive" });
    },
  });

  const saveGeminiKeyMutation = useMutation({
    mutationFn: async (apiKey: string) => {
      const res = await authFetch(`${BASE}/api/settings/gemini`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as any).message || "Failed to save key");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: language === "ar" ? "✅ تم حفظ مفتاح Gemini بنجاح" : "✅ Gemini API key saved!" });
      queryClient.invalidateQueries({ queryKey: ["gemini-settings"] });
      setGeminiKey("");
    },
    onError: (err: any) => {
      toast({ title: language === "ar" ? "خطأ في حفظ المفتاح" : "Save Error", description: err.message, variant: "destructive" });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`${BASE}/api/whatsapp/instance`, { method: "DELETE" });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as any).message || "Failed to logout");
      }
    },
    onSuccess: () => {
      setIsPolling(false);
      stopCountdown();
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instance"] });
      toast({ title: language === "ar" ? "تم تسجيل الخروج بنجاح" : "Logged out successfully" });
    },
    onError: (err: any) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  const setMainMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`${BASE}/api/whatsapp/instance/set-main`, { method: "POST" });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as any).message || "Failed to set as main");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instance"] });
      toast({ title: language === "ar" ? "✅ تم التعيين كرقم رئيسي بنجاح" : "✅ Set as main number successfully!" });
    },
    onError: (err: any) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  // ── Refresh QR ────────────────────────────────────────────────────────────
  const refreshQR = useCallback(() => {
    connectMutation.mutate();
  }, [connectMutation]);

  // ── Countdown color ───────────────────────────────────────────────────────
  const getCountdownColor = () => {
    if (qrCountdown === null) return "text-muted-foreground";
    if (qrCountdown > 30) return "text-emerald-600";
    if (qrCountdown > 15) return "text-yellow-500";
    return "text-destructive";
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isConnected = data?.status === "open";

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6 animate-in fade-in zoom-in-95 duration-500">
      {/* ── Monthly Target Progress Card (All Roles) ── */}
      {targetProgress && targetProgress.monthlyTarget > 0 && (
        <Card className="bg-card border-border shadow-md overflow-hidden text-start relative bg-gradient-to-br from-indigo-500/5 via-transparent to-emerald-500/5">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full filter blur-2xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/10 rounded-full filter blur-2xl pointer-events-none" />
          
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-xl text-foreground">
              <Target className="h-5 w-5 text-emerald-500 animate-pulse" />
              {language === "ar" ? "مؤشر التارجت الشهري للمركز" : "Monthly Revenue Target"}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {language === "ar"
                ? "متابعة أرباح المبيعات المحققة والنسبة المتبقية لتحقيق التارجت المستهدف خلال الشهر الجاري."
                : "Track current monthly sales profit against target objectives."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Achieved vs Target */}
            <div className="flex justify-between items-baseline flex-wrap gap-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {language === "ar" ? "إجمالي الأرباح المحققة" : "Total Profit Achieved"}
                </p>
                <h3 className="text-3xl font-extrabold text-foreground mt-1 flex items-baseline gap-1">
                  {targetProgress.totalAchieved.toLocaleString("ar-KW", { minimumFractionDigits: 2 })}
                  <span className="text-sm font-normal text-muted-foreground">د.ك</span>
                </h3>
              </div>
              <div className="text-end">
                <p className="text-sm font-medium text-muted-foreground">
                  {language === "ar" ? "التارجت المستهدف" : "Target Goal"}
                </p>
                <h4 className="text-xl font-bold text-muted-foreground mt-1">
                  {targetProgress.monthlyTarget.toLocaleString("ar-KW")} د.ك
                </h4>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="relative w-full h-3.5 bg-muted rounded-full overflow-hidden border border-border/50">
                <div
                  className="h-full rounded-full transition-all duration-1000 bg-gradient-to-r from-emerald-500 to-teal-400"
                  style={{ width: `${Math.min(100, targetProgress.percentage)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground font-medium">
                <span>{targetProgress.percentage}% {language === "ar" ? "مكتمل" : "completed"}</span>
                {targetProgress.remaining > 0 ? (
                  <span>
                    {language === "ar" ? "متبقي" : "remaining"}{" "}
                    <span className="font-semibold text-foreground">
                      {targetProgress.remaining.toLocaleString("ar-KW", { minimumFractionDigits: 2 })} د.ك
                    </span>
                  </span>
                ) : (
                  <span className="text-emerald-500 font-bold">
                    🎉 {language === "ar" ? "تم تحقيق التارجت بنجاح!" : "Target achieved!"}
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-card border-border shadow-sm text-start">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl text-foreground">
            <QrCode className="h-6 w-6 text-primary" />
            {t("whatsapp.settings.title")}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {language === "ar" ? "اربط رقم الواتساب الخاص بك لإرسال وتلقي إشعارات الحجز ورسائل العملاء." : "Link your WhatsApp number to reply to customers and send notifications."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status row */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/20 flex-wrap gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">{language === "ar" ? "حالة الاتصال" : "Connection Status"}</p>
              <div className="flex items-center gap-2 mt-1">
                {isConnected ? (
                  <span className="flex items-center gap-1.5 text-emerald-600 text-sm font-medium">
                    <CheckCircle2 className="h-4 w-4" /> {t("whatsapp.statusConnected")}
                  </span>
                ) : data?.status === "connecting" ? (
                  <span className="flex items-center gap-1.5 text-yellow-600 text-sm font-medium">
                    <Loader2 className="h-4 w-4 animate-spin" /> {t("whatsapp.statusConnecting")}
                  </span>
                ) : (
                  <span className="text-destructive text-sm font-medium">{t("whatsapp.statusDisconnected")}</span>
                )}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-foreground">{language === "ar" ? "معرف الجلسة" : "Session ID"}</p>
              <p className="text-sm text-muted-foreground mt-1">{data?.instanceName}</p>
            </div>
          </div>

          {/* QR / connect area */}
          {!isConnected && (
            <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-border rounded-lg bg-muted/10">
              {data?.qrCode ? (
                <div className="space-y-4 text-center">
                  {/* QR image */}
                  <div className="relative bg-white p-4 rounded-xl inline-block border border-border">
                    <img src={data.qrCode} alt="QR Code" className="w-64 h-64" />
                    {/* Overlay spinner when refreshing */}
                    {connectMutation.isPending && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-xl">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                      </div>
                    )}
                  </div>

                  <p className="text-sm text-muted-foreground">
                    {language === "ar" ? "افتح تطبيق الواتساب ← الأجهزة المرتبطة ← امسح رمز الاستجابة السريعة" : "Open WhatsApp → Linked Devices → Scan QR Code"}
                  </p>

                  {/* Countdown + refresh */}
                  <div className="flex items-center justify-center gap-4">
                    {qrCountdown !== null && (
                      <span className={`text-sm font-mono font-semibold tabular-nums ${getCountdownColor()}`}>
                        ⏱ {qrCountdown}s
                      </span>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-primary text-primary hover:bg-primary/10"
                      onClick={refreshQR}
                      disabled={connectMutation.isPending}
                    >
                      <RefreshCw className="me-1.5 h-3.5 w-3.5" />
                      {language === "ar" ? "تحديث الرمز" : "Refresh QR"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <QrCode className="h-16 w-16 mx-auto text-muted-foreground opacity-50" />
                  <p className="text-sm text-muted-foreground">{language === "ar" ? "لم يتم إنشاء رمز استجابة سريعة بعد." : "No QR code generated yet."}</p>
                  <Button
                    onClick={() => connectMutation.mutate()}
                    disabled={connectMutation.isPending}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {connectMutation.isPending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
                    {language === "ar" ? "توليد رمز الاستجابة السريعة" : "Generate QR Code"}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Main Instance Selection */}
          {isConnected && (
            <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/10">
              <div>
                <p className="text-sm font-medium text-foreground">{language === "ar" ? "رقم الواتساب الرئيسي للمركز" : "Main WhatsApp Number"}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {data?.isMainInstance 
                    ? (language === "ar" ? "هذا هو الرقم الرئيسي لتوزيع المحادثات" : "This is the main number for routing chats")
                    : (language === "ar" ? "اضغط لتعيين هذا الرقم لاستقبال رسائل العملاء الجدد وتوزيعها" : "Click to set this number to receive and route new customer messages")}
                </p>
              </div>
              <Button
                variant={data?.isMainInstance ? "secondary" : "outline"}
                disabled={data?.isMainInstance || setMainMutation.isPending}
                onClick={() => setMainMutation.mutate()}
                className={data?.isMainInstance ? "bg-emerald-50 text-emerald-700 border-emerald-200 pointer-events-none" : ""}
              >
                {setMainMutation.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                {data?.isMainInstance 
                  ? (language === "ar" ? "الرقم الرئيسي ✓" : "Main Number ✓") 
                  : (language === "ar" ? "تعيين كرقم رئيسي" : "Set as Main")}
              </Button>
            </div>
          )}

          {/* Logout */}
          {data?.status && data.status !== "disconnected" && (
            <div className="flex justify-end mt-6">
              <Button
                variant="destructive"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
              >
                {logoutMutation.isPending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <LogOut className="me-2 h-4 w-4" />}
                {language === "ar" ? "تسجيل الخروج وقطع الاتصال" : "Logout and Disconnect"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Gemini AI Settings (Admin only) ──────────────────────────────── */}
      {(
        <Card className="bg-card border-border shadow-sm text-start">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl text-foreground">
              <BrainCircuit className="h-5 w-5 text-primary" />
              {language === "ar" ? "إعدادات Gemini AI" : "Gemini AI Settings"}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {language === "ar"
                ? "أضف مفتاح Gemini API لتفعيل خاصية توليد رسائل الحملات بالذكاء الاصطناعي."
                : "Add your Gemini API key to enable AI-powered campaign message generation."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Key Status */}
            <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/20 flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className={`h-5 w-5 ${geminiStatus?.hasKey ? "text-emerald-500" : "text-muted-foreground"}`} />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {language === "ar" ? "حالة المفتاح" : "Key Status"}
                  </p>
                  <p className={`text-sm mt-0.5 ${geminiStatus?.hasKey ? "text-emerald-600 font-medium" : "text-muted-foreground"}`}>
                    {geminiLoading
                      ? (language === "ar" ? "جارٍ التحقق..." : "Checking...")
                      : geminiStatus?.hasKey
                        ? (language === "ar" ? "✅ مفتاح Gemini محفوظ وجاهز للاستخدام" : "✅ Gemini API key is saved and ready")
                        : (language === "ar" ? "⚠️ لم يتم إعداد مفتاح Gemini بعد" : "⚠️ No Gemini API key configured yet")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-2.5 py-1.5 rounded-md border border-border/50">
                <Key className="h-3 w-3" />
                <span>{language === "ar" ? "للمسؤول فقط" : "Admin only"}</span>
              </div>
            </div>

            {/* Key Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {language === "ar"
                  ? (geminiStatus?.hasKey ? "تحديث مفتاح Gemini API" : "إضافة مفتاح Gemini API")
                  : (geminiStatus?.hasKey ? "Update Gemini API Key" : "Add Gemini API Key")}
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    id="gemini-key-input"
                    type={showGeminiKey ? "text" : "password"}
                    placeholder={language === "ar" ? "AIza... (أدخل مفتاح Gemini API)" : "AIza... (Enter Gemini API key)"}
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    className="pe-10 font-mono text-sm"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 end-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowGeminiKey(v => !v)}
                    tabIndex={-1}
                  >
                    {showGeminiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button
                  id="save-gemini-key-btn"
                  onClick={() => saveGeminiKeyMutation.mutate(geminiKey)}
                  disabled={saveGeminiKeyMutation.isPending || geminiKey.trim().length < 10}
                  className="bg-primary hover:bg-primary/90 shrink-0"
                >
                  {saveGeminiKeyMutation.isPending
                    ? <Loader2 className="me-2 h-4 w-4 animate-spin" />
                    : <Key className="me-2 h-4 w-4" />}
                  {language === "ar"
                    ? (geminiStatus?.hasKey ? "تحديث" : "حفظ")
                    : (geminiStatus?.hasKey ? "Update" : "Save")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {language === "ar"
                  ? "احصل على مفتاحك من Google AI Studio: aistudio.google.com — المفتاح لن يظهر مرة أخرى بعد الحفظ."
                  : "Get your key from Google AI Studio: aistudio.google.com — The key will not be shown again after saving."}
              </p>
            </div>

            {/* Usage info */}
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/30">
              <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                {language === "ar"
                  ? "ℹ️ حد الاستخدام: يمكن لكل موظف توليد رسائل بالذكاء الاصطناعي مرتين فقط كل 24 ساعة."
                  : "ℹ️ Usage limit: Each employee can generate AI messages up to 2 times per 24 hours."}
              </p>
            </div>

          </CardContent>
        </Card>
      )}

      {/* ── WhatsApp Notifications & Monthly Target (Admin only) ── */}
      {(
        <Card className="bg-card border-border shadow-sm text-start">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl text-foreground">
              <Bell className="h-5 w-5 text-primary" />
              {language === "ar" ? "إعدادات الإشعارات والتارجت الشهري" : "Notification & Target Settings"}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {language === "ar"
                ? "تخصيص مستلم الرسائل التلقائية عند إضافة العملاء أو التذاكر وتعديل التارجت المالي."
                : "Configure automated notification triggers and center financial objectives."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {notifLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {/* 1. Toggle Customer & Ticket Notifications */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/10">
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-foreground">
                        {language === "ar" ? "إشعارات العملاء الجدد" : "New Customer Alerts"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {language === "ar" ? "إرسال رسالة عند إضافة عميل" : "Notify on new customer"}
                      </p>
                    </div>
                    <Switch
                      checked={enabledCustomer}
                      onCheckedChange={setEnabledCustomer}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/10">
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-foreground">
                        {language === "ar" ? "إشعارات التذاكر الجديدة" : "New Ticket Alerts"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {language === "ar" ? "إرسال رسالة عند إضافة تذكرة" : "Notify on new ticket"}
                      </p>
                    </div>
                    <Switch
                      checked={enabledTicket}
                      onCheckedChange={setEnabledTicket}
                    />
                  </div>
                </div>

                {/* 2. Recipient Type */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    {language === "ar" ? "مستقبل إشعارات الواتساب" : "WhatsApp Recipient"}
                  </label>
                  <Select
                    value={recipientType}
                    onValueChange={(val: "main" | "custom") => setRecipientType(val)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="main">
                        {language === "ar" ? "الرقم المرتبط حالياً بالنظام (الرقم الرئيسي)" : "System Linked Number (Main)"}
                      </SelectItem>
                      <SelectItem value="custom">
                        {language === "ar" ? "رقم واتساب مخصص آخر" : "Custom WhatsApp Number"}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 3. Custom Number Input */}
                {recipientType === "custom" && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <label className="text-sm font-medium text-foreground">
                      {language === "ar" ? "رقم الهاتف المستلم (رمز الدولة + الرقم)" : "Recipient Phone Number (with Country Code)"}
                    </label>
                    <Input
                      type="text"
                      placeholder="e.g. 96590000000"
                      value={customNumber}
                      onChange={(e) => setCustomNumber(e.target.value.replace(/[^0-9]/g, ""))}
                      className="font-mono text-sm"
                      dir="ltr"
                    />
                    <p className="text-xs text-muted-foreground">
                      {language === "ar" ? "اكتب الرقم كاملاً بدون أصفار في البداية أو علامة (+)." : "Enter full number without leading zeros or (+)."}
                    </p>
                  </div>
                )}

                {/* 4. Target Input */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    {language === "ar" ? "التارجت المالي الشهري للمركز (دينار كويتي)" : "Monthly Target Profit (KWD)"}
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      min={0}
                      placeholder="150"
                      value={monthlyTarget || ""}
                      onChange={(e) => setMonthlyTarget(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="pe-12 font-medium"
                    />
                    <span className="absolute inset-y-0 end-0 flex items-center px-3 text-sm font-bold text-muted-foreground bg-muted/50 border-s rounded-e-md">
                      د.ك
                    </span>
                  </div>
                </div>

                {/* Save button */}
                <div className="flex justify-end pt-2">
                  <Button
                    onClick={() => saveNotifSettingsMutation.mutate({
                      enabledCustomer,
                      enabledTicket,
                      recipientType,
                      customNumber,
                      monthlyTarget,
                    })}
                    disabled={saveNotifSettingsMutation.isPending}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground min-w-[120px]"
                  >
                    {saveNotifSettingsMutation.isPending && (
                      <Loader2 className="me-2 h-4 w-4 animate-spin" />
                    )}
                    {language === "ar" ? "حفظ إعدادات الإشعارات" : "Save Notifications"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── WhatsApp Routing Agents (Targets) ──────────────────────────────── */}
      {isAdmin && (
        <Card className="bg-card border-border shadow-sm text-start">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl text-foreground">
              <Users className="h-5 w-5 text-primary" />
              {language === "ar" ? "مستلمو توزيع العملاء (Targets)" : "Lead Routing Targets"}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {language === "ar"
                ? "إدارة الموظفين الذين يستقبلون العملاء الجدد عبر نظام التوزيع العادل (Round Robin) من الرقم الرئيسي."
                : "Manage employees who receive new leads via round-robin distribution from the main number."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* Add new agent */}
            <div className="flex flex-col sm:flex-row gap-3 items-end p-4 rounded-lg border border-border bg-muted/10">
              <div className="w-full sm:flex-1 space-y-1.5">
                <label className="text-sm font-medium">{language === "ar" ? "الموظف" : "Employee"}</label>
                <Select value={newAgentEmployeeId} onValueChange={setNewAgentEmployeeId}>
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
              <div className="w-full sm:flex-1 space-y-1.5">
                <label className="text-sm font-medium">{language === "ar" ? "رقم استقبال الواتساب" : "WhatsApp Number"}</label>
                <Input
                  type="text"
                  placeholder="e.g. 96590000000"
                  value={newAgentPhone}
                  onChange={(e) => setNewAgentPhone(e.target.value.replace(/[^0-9]/g, ""))}
                  dir="ltr"
                />
              </div>
              <Button
                onClick={() => addAgentMutation.mutate()}
                disabled={!newAgentEmployeeId || !newAgentPhone || addAgentMutation.isPending}
                className="w-full sm:w-auto"
              >
                {addAgentMutation.isPending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <UserPlus className="me-2 h-4 w-4" />}
                {language === "ar" ? "إضافة للقائمة" : "Add Target"}
              </Button>
            </div>

            {/* List of agents */}
            <div className="space-y-3">
              {agentsLoading ? (
                <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : routingAgents?.agents?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {language === "ar" ? "لا يوجد موظفين في قائمة التوزيع." : "No routing targets configured."}
                </p>
              ) : (
                routingAgents?.agents?.map(agent => (
                  <div key={agent.id} className="flex items-center justify-between p-3 rounded-md border border-border bg-card">
                    <div>
                      <p className="font-semibold text-sm flex items-center gap-2">
                        {agent.employeeName}
                        {!agent.isActive && (
                          <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded uppercase">
                            {language === "ar" ? "متوقف" : "Paused"}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5" dir="ltr">{agent.agentPhone}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {language === "ar" ? `تم استلام ${agent.totalAssigned} عميل` : `Received ${agent.totalAssigned} leads`}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {agent.isActive ? (language === "ar" ? "نشط" : "Active") : (language === "ar" ? "إيقاف" : "Inactive")}
                        </span>
                        <Switch
                          checked={agent.isActive}
                          onCheckedChange={(val) => toggleAgentMutation.mutate({ id: agent.id, isActive: val })}
                          disabled={toggleAgentMutation.isPending}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          if (confirm(language === "ar" ? "هل أنت متأكد من حذف الموظف من قائمة التوزيع؟" : "Are you sure you want to remove this target?")) {
                            deleteAgentMutation.mutate(agent.id);
                          }
                        }}
                        disabled={deleteAgentMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

          </CardContent>
        </Card>
      )}

    </div>
  );
}
