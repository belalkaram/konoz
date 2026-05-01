import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Settings, Mail, Save, Loader2, Server, User, Key, Type } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { authFetch, BASE } from "@/lib/api";

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
      if (!res.ok) throw new Error("Failed to fetch settings");
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
        throw new Error(error.message || "Failed to update settings");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Settings saved", description: "Global email settings have been updated in the database." });
      setOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
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
          System Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Global System Settings
            </DialogTitle>
            <DialogDescription>
              Configure SMTP and other system-wide parameters. These are saved permanently in the database.
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
                  <Label className="flex items-center gap-2">
                    <Server className="h-3.5 w-3.5 text-muted-foreground" />
                    SMTP Host
                  </Label>
                  <Input
                    placeholder="smtp.gmail.com"
                    value={form.host}
                    onChange={(e) => setForm({ ...form, host: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Type className="h-3.5 w-3.5 text-muted-foreground" />
                    SMTP Port
                  </Label>
                  <Input
                    type="number"
                    placeholder="587"
                    value={form.port}
                    onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  SMTP User (Email)
                </Label>
                <Input
                  type="email"
                  placeholder="system@gmail.com"
                  value={form.user}
                  onChange={(e) => setForm({ ...form, user: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Key className="h-3.5 w-3.5 text-muted-foreground" />
                  SMTP Password {settings?.hasPass && "(Stored)"}
                </Label>
                <Input
                  type="password"
                  placeholder={settings?.hasPass ? "Leave blank to keep current" : "Enter App Password"}
                  value={form.pass}
                  onChange={(e) => setForm({ ...form, pass: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  Sender Name
                </Label>
                <Input
                  placeholder="AeroOps System"
                  value={form.fromName}
                  onChange={(e) => setForm({ ...form, fromName: e.target.value })}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending || isLoading} className="gap-2">
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save to Database
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
