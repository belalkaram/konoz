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

interface Props {
  employee: Employee;
}

export function EmployeeSettingsDialog({ employee }: Props) {
  const [email, setEmail] = useState(employee.email || "");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const { refreshCurrentEmployee } = useEmployee();

  const mutation = useMutation({
    mutationFn: async (newEmail: string) => {
      const res = await authFetch(`${BASE}/api/employees/me/email`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update email");
      }
      return res.json();
    },
    onSuccess: () => {
      refreshCurrentEmployee();
      toast({ title: "Settings updated", description: "Your notification email has been saved." });
      setOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
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
          className="p-1.5 rounded-full transition-colors flex-shrink-0"
          style={{ color: "rgba(255,255,255,0.4)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.8)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.4)"; }}
          title="Notification Settings"
        >
          <Settings className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Notification Settings
            </DialogTitle>
            <DialogDescription>
              Update your email address to receive traveler notifications and trip reminders.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Notification Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="your-email@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={mutation.isPending}
              />
              <p className="text-[0.8rem] text-muted-foreground">
                This is where you'll receive alerts for new travelers and 24-hour reminders.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending} className="gap-2">
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
