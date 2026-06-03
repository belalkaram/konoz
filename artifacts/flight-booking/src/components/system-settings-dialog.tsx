import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Settings, Mail, Save, Loader2, Server, User, Key, Type } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { authFetch, BASE } from "@/lib/api";
import { useLanguage } from "@/contexts/language-context";

interface SmtpSettings {
  host: string;
  port: number;
  user: string;
  fromName: string;
  hasPass: boolean;
}

export function SystemSettingsDialog() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const { isRtl, t } = useLanguage();
  const [form, setForm] = useState({
    host: "",
    port: 587,
    user: "",
    pass: "",
    fromName: "",
  });

  const { data: settings, isLoading } = useQuery<SmtpSettings>({
    queryKey: ["system-settings-email"],
    queryFn: async () => {
      const res = await authFetch(`${BASE}/api/settings/email`);
      if (!res.ok) throw new Error(isRtl ? "فشل جلب الإعدادات" : "Failed to fetch settings");
      return res.json();
    },
    enabled: open,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        host: settings.host,
        port: settings.port,
        user: settings.user,
        fromName: settings.fromName,
        pass: "", // Don't show password
      });
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await authFetch(`${BASE}/api/settings/email`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || (isRtl ? "فشل تحديث الإعدادات" : "Failed to update settings"));
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: isRtl ? "تم حفظ الإعدادات" : "Settings saved",
        description: isRtl ? "تم تحديث إعدادات البريد الإلكتروني العامة بنجاح." : "Global email settings have been updated in the database."
      });
      setOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: isRtl ? "فشل الحفظ" : "Save failed",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate(form);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          {isRtl ? "إعدادات النظام" : "System Settings"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit} className="text-start">
          <DialogHeader className="text-start">
            <DialogTitle className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : "flex-row"}`}>
              <Server className="h-5 w-5" />
              {isRtl ? "إعدادات النظام العامة" : "Global System Settings"}
            </DialogTitle>
            <DialogDescription className="text-start">
              {isRtl
                ? "تكوين إعدادات SMTP والمعلمات العامة الأخرى للنظام. يتم حفظها بشكل دائم في قاعدة البيانات."
                : "Configure SMTP and other system-wide parameters. These are saved permanently in the database."}
            </DialogDescription>
          </DialogHeader>
          
          {isLoading ? (
            <div className="py-12 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : "flex-row"}`}>
                    <Server className="h-3.5 w-3.5 text-muted-foreground" />
                    {isRtl ? "خادم SMTP" : "SMTP Host"}
                  </Label>
                  <Input
                    placeholder="smtp.gmail.com"
                    value={form.host}
                    onChange={(e) => setForm({ ...form, host: e.target.value })}
                    className="text-start dir-ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : "flex-row"}`}>
                    <Type className="h-3.5 w-3.5 text-muted-foreground" />
                    {isRtl ? "منفذ SMTP" : "SMTP Port"}
                  </Label>
                  <Input
                    type="number"
                    placeholder="587"
                    value={form.port}
                    onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 0 })}
                    className="text-start dir-ltr"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : "flex-row"}`}>
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  {isRtl ? "اسم المستخدم (البريد الإكتروني) لـ SMTP" : "SMTP User (Email)"}
                </Label>
                <Input
                  type="email"
                  placeholder="system@gmail.com"
                  value={form.user}
                  onChange={(e) => setForm({ ...form, user: e.target.value })}
                  className="text-start dir-ltr"
                />
              </div>

              <div className="space-y-2">
                <Label className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : "flex-row"}`}>
                  <Key className="h-3.5 w-3.5 text-muted-foreground" />
                  {isRtl ? "كلمة مرور SMTP" : "SMTP Password"} {settings?.hasPass && (isRtl ? "(مخزنة)" : "(Stored)")}
                </Label>
                <Input
                  type="password"
                  placeholder={settings?.hasPass ? (isRtl ? "اتركه فارغاً للاحتفاظ بالحالية" : "Leave blank to keep current") : (isRtl ? "أدخل كلمة مرور التطبيق" : "Enter App Password")}
                  value={form.pass}
                  onChange={(e) => setForm({ ...form, pass: e.target.value })}
                  className="text-start dir-ltr"
                />
              </div>

              <div className="space-y-2">
                <Label className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : "flex-row"}`}>
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  {isRtl ? "اسم المرسل" : "Sender Name"}
                </Label>
                <Input
                  placeholder="Konoz System"
                  value={form.fromName}
                  onChange={(e) => setForm({ ...form, fromName: e.target.value })}
                  className="text-start"
                />
              </div>
            </div>
          )}

          <DialogFooter className={`flex gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={mutation.isPending}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending || isLoading} className="gap-2">
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isRtl ? "حفظ في قاعدة البيانات" : "Save to Database"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

