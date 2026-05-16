import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, QrCode, LogOut, CheckCircle2 } from "lucide-react";
import { authFetch, BASE } from "@/lib/api";

export default function WhatsappSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isPolling, setIsPolling] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["whatsapp-instance"],
    queryFn: async () => {
      const res = await authFetch(`${BASE}/api/whatsapp/instance`);
      if (!res.ok) throw new Error("Failed to fetch instance");
      return res.json() as Promise<{ instanceName: string; status: string; qrCode: string | null }>;
    },
    refetchInterval: isPolling ? 3000 : false,
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`${BASE}/api/whatsapp/instance/connect`, { method: "POST" });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to connect");
      }
      return res.json();
    },
    onSuccess: () => {
      setIsPolling(true);
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instance"] });
    },
    onError: (err: any) => {
      toast({
        title: "خطأ في الاتصال",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`${BASE}/api/whatsapp/instance`, { method: "DELETE" });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to logout");
      }
    },
    onSuccess: () => {
      setIsPolling(false);
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instance"] });
      toast({ title: "تم تسجيل الخروج بنجاح" });
    },
    onError: (err: any) => {
      toast({
        title: "خطأ",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // Stop polling if connected
  if (isPolling && data?.status === "open") {
    setIsPolling(false);
    toast({ title: "تم الاتصال بالواتساب بنجاح!" });
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  const isConnected = data?.status === "open";
  const isConnecting = data?.status === "connecting";

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6 animate-in fade-in zoom-in-95 duration-500">
      <Card className="bg-slate-900/50 border-emerald-900/30 shadow-xl backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl text-emerald-50">
            <QrCode className="h-6 w-6 text-emerald-400" />
            إعدادات الواتساب
          </CardTitle>
          <CardDescription className="text-emerald-200/60">
            قم بربط رقم الواتساب الخاص بك للرد على العملاء وإرسال الإشعارات.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 rounded-lg border border-slate-800 bg-slate-950/50">
            <div>
              <p className="text-sm font-medium text-emerald-100">حالة الاتصال</p>
              <div className="flex items-center gap-2 mt-1">
                {isConnected ? (
                  <span className="flex items-center gap-1.5 text-emerald-400 text-sm font-medium">
                    <CheckCircle2 className="h-4 w-4" /> متصل
                  </span>
                ) : isConnecting ? (
                  <span className="flex items-center gap-1.5 text-yellow-400 text-sm font-medium">
                    <Loader2 className="h-4 w-4 animate-spin" /> قيد الانتظار / جاري الاتصال
                  </span>
                ) : (
                  <span className="text-red-400 text-sm font-medium">غير متصل</span>
                )}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-emerald-100">معرف الجلسة</p>
              <p className="text-sm text-slate-400 mt-1">{data?.instanceName}</p>
            </div>
          </div>

          {!isConnected && (
            <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-800 rounded-lg bg-slate-900/30">
              {data?.qrCode ? (
                <div className="space-y-4 text-center">
                  <div className="bg-white p-4 rounded-xl inline-block">
                    <img src={data.qrCode} alt="QR Code" className="w-64 h-64" />
                  </div>
                  <p className="text-sm text-slate-400">
                    افتح تطبيق الواتساب على هاتفك، اذهب إلى الأجهزة المرتبطة، ثم امسح الرمز أعلاه.
                  </p>
                  {!isPolling && (
                    <Button
                      variant="outline"
                      className="mt-4 border-emerald-800 hover:bg-emerald-900/30 text-emerald-400"
                      onClick={() => setIsPolling(true)}
                    >
                      بدء التحقق من الاتصال
                    </Button>
                  )}
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <QrCode className="h-16 w-16 mx-auto text-slate-600" />
                  <p className="text-sm text-slate-400">لم يتم إنشاء رمز QR بعد.</p>
                  <Button
                    onClick={() => connectMutation.mutate()}
                    disabled={connectMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    {connectMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    توليد رمز الاستجابة السريعة (QR Code)
                  </Button>
                </div>
              )}
            </div>
          )}

          {isConnected && (
            <div className="flex justify-end">
              <Button
                variant="destructive"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
              >
                {logoutMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
                تسجيل الخروج وقطع الاتصال
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
