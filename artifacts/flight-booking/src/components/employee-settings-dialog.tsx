import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Settings, Mail, Save, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { authFetch, BASE } from "@/lib/api";
import { Employee, useEmployee } from "@/contexts/employee-context";
import { useLanguage } from "@/contexts/language-context";

interface Props {
  employee: Employee;
}

export function EmployeeSettingsDialog({ employee }: Props) {
  const [email, setEmail] = useState(employee.email || "");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const { refreshCurrentEmployee } = useEmployee();
  const { isRtl, t } = useLanguage();

  const mutation = useMutation({
    mutationFn: async (newEmail: string) => {
      const res = await authFetch(`${BASE}/api/employees/me/email`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || (isRtl ? "فشل تحديث البريد الإلكتروني" : "Failed to update email"));
      }
      return res.json();
    },
    onSuccess: () => {
      refreshCurrentEmployee();
      toast({
        title: isRtl ? "تم تحديث الإعدادات" : "Settings updated",
        description: isRtl ? "تم حفظ بريدك الإلكتروني بنجاح." : "Your notification email has been saved."
      });
      setOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: isRtl ? "فشل التحديث" : "Update failed",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate(email);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="p-1.5 rounded-full transition-colors flex-shrink-0 text-white/40 hover:text-white/80 hover:bg-white/5"
          title={isRtl ? "إعدادات الإشعارات" : "Notification Settings"}
        >
          <Settings className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit} className="text-start">
          <DialogHeader className="text-start">
            <DialogTitle className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : "flex-row"}`}>
              <Settings className="h-5 w-5" />
              {isRtl ? "إعدادات الإشعارات" : "Notification Settings"}
            </DialogTitle>
            <DialogDescription className="text-start">
              {isRtl
                ? "قم بتحديث بريدك الإلكتروني لتلقي إشعارات المسافرين وتذكيرات الرحلات."
                : "Update your email address to receive traveler notifications and trip reminders."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email" className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : "flex-row"}`}>
                <Mail className="h-4 w-4 text-muted-foreground" />
                {isRtl ? "البريد الإلكتروني للإشعارات" : "Notification Email"}
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="your-email@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={mutation.isPending}
                className="text-start dir-ltr"
              />
              <p className="text-[0.8rem] text-muted-foreground">
                {isRtl
                  ? "هنا ستتلقى تنبيهات المسافرين الجدد وتذكيرات الـ 24 ساعة."
                  : "This is where you'll receive alerts for new travelers and 24-hour reminders."}
              </p>
            </div>
          </div>
          <DialogFooter className={`flex gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={mutation.isPending}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending} className="gap-2">
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isRtl ? "حفظ التغييرات" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

