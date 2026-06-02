import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, QrCode, LogOut, CheckCircle2, RefreshCw } from "lucide-react";
import { useLanguage } from "@/contexts/language-context";
import { authFetch, BASE } from "@/lib/api";

const QR_LIFETIME_SECONDS = 55; // Refresh just before 60s expiry

export default function WhatsappSettings() {
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
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
      return res.json() as Promise<{ instanceName: string; status: string; qrCode: string | null }>;
    },
    refetchInterval: isPolling ? 3000 : false,
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
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5 rtl:mr-0 rtl:ml-1.5" />
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
                    {connectMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
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
                {setMainMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {data?.isMainInstance 
                  ? (language === "ar" ? "الرقم الرئيسي ✓" : "Main Number ✓") 
                  : (language === "ar" ? "تعيين كرقم رئيسي" : "Set as Main")}
              </Button>
            </div>
          )}

          {/* Logout */}
          {isConnected && (
            <div className="flex justify-end mt-6">
              <Button
                variant="destructive"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
              >
                {logoutMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
                {language === "ar" ? "تسجيل الخروج وقطع الاتصال" : "Logout and Disconnect"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
