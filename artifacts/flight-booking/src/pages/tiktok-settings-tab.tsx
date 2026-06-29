import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/language-context";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { authFetch, BASE } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Link2, Trash2, CheckCircle2, AlertTriangle, RefreshCw, QrCode, Key } from "lucide-react";

export function TiktokSettingsTab() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrSessionId, setQrSessionId] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [manualSessionId, setManualSessionId] = useState<string>("");

  const { data: status, isLoading } = useQuery({
    queryKey: ["tiktok-status"],
    queryFn: async () => {
      const res = await authFetch(`${BASE}/api/tiktok/status`);
      if (!res.ok) throw new Error("Failed to fetch status");
      return res.json();
    }
  });

  const startQrMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`${BASE}/api/tiktok/auth/qr/start`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to start QR session");
      return res.json();
    },
    onSuccess: (data) => {
      setQrSessionId(data.sessionId);
      setQrDataUrl(data.qrDataUrl);
      setQrModalOpen(true);
    },
    onError: () => {
      toast({ 
        title: language === "ar" ? "خطأ" : "Error", 
        description: language === "ar" ? "فشل في توليد الباركود. يرجى المحاولة مرة أخرى." : "Failed to generate QR code. Please try again.",
        variant: "destructive" 
      });
    }
  });

  // Start manual session mutation
  const manualConnectMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await authFetch(`${BASE}/api/tiktok/auth/session`, { 
        method: "POST",
        body: JSON.stringify({ sessionId })
      });
      if (!res.ok) throw new Error("Failed to connect manually");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tiktok/status"] });
      setManualSessionId("");
      toast({ 
        title: language === "ar" ? "تم الربط" : "Connected", 
        description: language === "ar" ? "تم ربط حساب تيك توك بنجاح!" : "TikTok account linked successfully!",
        variant: "default" 
      });
    },
    onError: () => {
      toast({ 
        title: language === "ar" ? "خطأ" : "Error", 
        description: language === "ar" ? "فشل في الربط. تأكد من صحة Session ID." : "Failed to link. Verify your Session ID.",
        variant: "destructive" 
      });
    }
  });

  // Polling for QR status
  useEffect(() => {
    if (!qrModalOpen || !qrSessionId) return;

    const interval = setInterval(async () => {
      try {
        const res = await authFetch(`${BASE}/api/tiktok/auth/qr/status?sessionId=${qrSessionId}`);
        if (!res.ok) return;
        const data = await res.json();
        
        if (data.status === "success") {
          clearInterval(interval);
          setQrModalOpen(false);
          setQrSessionId(null);
          setQrDataUrl(null);
          queryClient.invalidateQueries({ queryKey: ["tiktok-status"] });
          toast({ title: language === "ar" ? "✅ تم الربط بنجاح" : "✅ Linked successfully" });
        } else if (data.status === "failed" || data.status === "expired") {
          clearInterval(interval);
          setQrModalOpen(false);
          setQrSessionId(null);
          toast({ 
            title: language === "ar" ? "⚠️ فشل الربط" : "⚠️ Link Failed", 
            description: language === "ar" ? "انتهت صلاحية الباركود أو حدث خطأ." : "QR code expired or an error occurred.",
            variant: "destructive" 
          });
        }
      } catch (err) {
        console.error("Error polling QR status", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [qrModalOpen, qrSessionId, queryClient, language, toast]);

  const unlinkMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`${BASE}/api/tiktok/auth/unlink`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to unlink account");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tiktok-status"] });
      toast({ title: language === "ar" ? "🗑️ تم فصل الحساب" : "🗑️ Unlinked successfully" });
    }
  });

  if (isLoading) return <div className="flex justify-center p-8"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const isConnected = status?.connectionStatus === "connected";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">{language === "ar" ? "إعدادات الربط" : "Connection Settings"}</h2>
          <p className="text-muted-foreground text-sm">
            {language === "ar" 
              ? "قم بربط حساب TikTok عبر مسح الباركود (QR Code)."
              : "Link your TikTok account by scanning the QR Code."}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isConnected ? (
              <><CheckCircle2 className="h-5 w-5 text-emerald-500" /> {language === "ar" ? "الحساب متصل" : "Account Connected"}</>
            ) : (
              <><AlertTriangle className="h-5 w-5 text-amber-500" /> {language === "ar" ? "الحساب غير متصل" : "Account Not Connected"}</>
            )}
          </CardTitle>
          <CardDescription>
            {isConnected 
              ? (language === "ar" ? `متصل بحساب: @${status.username}` : `Connected as: @${status.username}`)
              : (language === "ar" ? "قم بمسح الباركود باستخدام تطبيق تيك توك لربط حسابك." : "Scan the QR code with the TikTok app to link your account.")
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isConnected ? (
            <div className="space-y-4">
              <div className="p-4 bg-muted/20 rounded-lg border border-border flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">@{status.username}</p>
                </div>
                <Button variant="destructive" onClick={() => unlinkMutation.mutate()} disabled={unlinkMutation.isPending}>
                  <Trash2 className="h-4 w-4 me-2" />
                  {language === "ar" ? "فصل الحساب" : "Unlink"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6 max-w-md mx-auto">
              <div className="space-y-4">
                <Button 
                  size="lg" 
                  className="w-full h-16 text-lg bg-[#25F4EE] hover:bg-[#25F4EE]/90 text-black border-2 border-black font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                  onClick={() => startQrMutation.mutate()} 
                  disabled={startQrMutation.isPending}
                >
                  {startQrMutation.isPending ? (
                    <RefreshCw className="h-6 w-6 me-2 animate-spin" />
                  ) : (
                    <QrCode className="h-6 w-6 me-2" />
                  )}
                  {language === "ar" ? "توليد باركود تيك توك (QR)" : "Generate TikTok QR"}
                </Button>
              </div>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-muted" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    {language === "ar" ? "أو الإدخال اليدوي" : "Or manual entry"}
                  </span>
                </div>
              </div>
              
              <div className="space-y-4 p-4 border rounded-lg bg-muted/10">
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Session ID
                  </label>
                  <Input 
                    placeholder={language === "ar" ? "أدخل قيمة الـ sessionid الخاصة بك" : "Enter your sessionid value"} 
                    value={manualSessionId}
                    onChange={(e) => setManualSessionId(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {language === "ar" 
                      ? "يمكنك الحصول عليه من ملفات الارتباط (Cookies) الخاصة بتيك توك بعد تسجيل الدخول من متصفحك."
                      : "You can find this in your TikTok browser cookies after logging in."}
                  </p>
                </div>
                <Button 
                  className="w-full"
                  onClick={() => manualConnectMutation.mutate(manualSessionId)}
                  disabled={!manualSessionId.trim() || manualConnectMutation.isPending}
                >
                  {manualConnectMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 me-2 animate-spin" />
                  ) : (
                    <Key className="h-4 w-4 me-2" />
                  )}
                  {language === "ar" ? "ربط يدوياً" : "Connect Manually"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={qrModalOpen} onOpenChange={(open) => !open && setQrModalOpen(false)}>
        <DialogContent className="sm:max-w-md flex flex-col items-center text-center">
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "امسح الباركود لربط تيك توك" : "Scan QR Code to Link TikTok"}</DialogTitle>
            <DialogDescription>
              {language === "ar" 
                ? "افتح تطبيق تيك توك على هاتفك > اذهب لصفحتك الشخصية > اضغط على أيقونة الإضافة في الأعلى > ثم اختر أيقونة المسح 🔍."
                : "Open TikTok app > Profile > Add friend icon > Scan icon 🔍."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center p-6 bg-white rounded-xl border-4 border-black mt-4">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="TikTok QR Code" className="w-64 h-64 object-contain" />
            ) : (
              <div className="w-64 h-64 flex items-center justify-center">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground animate-pulse mt-4">
            {language === "ar" ? "في انتظار المسح..." : "Waiting for scan..."}
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
