import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/language-context";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus, Save, Clock, ChevronRight, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { authFetch, BASE } from "@/lib/api";

export function WhatsappAutomationsTab() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSeqOpen, setIsSeqOpen] = useState(false);
  const [isStepOpen, setIsStepOpen] = useState(false);
  const [selectedSeqId, setSelectedSeqId] = useState<number | null>(null);
  const [seqName, setSeqName] = useState("");
  
  const [stepData, setStepData] = useState({
    delayHours: 24,
    messageTemplate: "",
    stepOrder: 1
  });

  const { data: sequences, isLoading } = useQuery({
    queryKey: ["whatsapp-automations"],
    queryFn: async () => {
      const res = await authFetch(`${BASE}/api/whatsapp/automations/sequences`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    }
  });

  const createSeqMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await authFetch(`${BASE}/api/whatsapp/automations/sequences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });
      if (!res.ok) throw new Error("Failed to create");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-automations"] });
      setIsSeqOpen(false);
      setSeqName("");
      toast({ title: "✅ Saved" });
    }
  });

  const deleteSeqMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await authFetch(`${BASE}/api/whatsapp/automations/sequences/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-automations"] });
      toast({ title: "🗑️ Deleted" });
    }
  });

  const createStepMutation = useMutation({
    mutationFn: async (data: typeof stepData & { sequenceId: number }) => {
      const { sequenceId, ...rest } = data;
      const res = await authFetch(`${BASE}/api/whatsapp/automations/sequences/${sequenceId}/steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rest)
      });
      if (!res.ok) throw new Error("Failed to create step");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-automations"] });
      setIsStepOpen(false);
      setStepData({ delayHours: 24, messageTemplate: "", stepOrder: 1 });
      toast({ title: "✅ Step Saved" });
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">{language === "ar" ? "المتابعة الآلية (Automations)" : "Automations"}</h2>
          <p className="text-muted-foreground text-sm">
            {language === "ar" 
              ? "أنشئ تسلسلات رسائل تلقائية للعملاء، تتوقف فوراً عند رد العميل."
              : "Create automated follow-up sequences that stop when the customer replies."}
          </p>
        </div>
        
        <Dialog open={isSeqOpen} onOpenChange={setIsSeqOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 me-2"/> {language === "ar" ? "تسلسل جديد" : "New Sequence"}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{language === "ar" ? "تسلسل أتمتة جديد" : "New Automation Sequence"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4 text-start">
              <div className="space-y-2">
                <label className="text-sm font-semibold">{language === "ar" ? "اسم التسلسل" : "Sequence Name"}</label>
                <Input value={seqName} onChange={e => setSeqName(e.target.value)} placeholder="e.g. Lead Follow-up" />
              </div>
              <Button className="w-full" onClick={() => createSeqMutation.mutate(seqName)} disabled={createSeqMutation.isPending || !seqName}>
                <Save className="h-4 w-4 me-2"/> {language === "ar" ? "حفظ" : "Save"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={isStepOpen} onOpenChange={setIsStepOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "إضافة خطوة متابعة" : "Add Follow-up Step"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4 text-start">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold">{language === "ar" ? "تأخير (بالساعات)" : "Delay (Hours)"}</label>
                <Input type="number" value={stepData.delayHours} onChange={e => setStepData({...stepData, delayHours: parseInt(e.target.value)})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">{language === "ar" ? "الترتيب" : "Order (Step Number)"}</label>
                <Input type="number" value={stepData.stepOrder} onChange={e => setStepData({...stepData, stepOrder: parseInt(e.target.value)})} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">{language === "ar" ? "نص الرسالة" : "Message Body"}</label>
              <Textarea value={stepData.messageTemplate} onChange={e => setStepData({...stepData, messageTemplate: e.target.value})} placeholder="مرحباً {{customer_name}}..." rows={4} />
              <p className="text-xs text-muted-foreground">Variables: {"{{customer_name}}, {{phone}}"}</p>
            </div>
            <Button className="w-full" onClick={() => selectedSeqId && createStepMutation.mutate({ ...stepData, sequenceId: selectedSeqId })} disabled={createStepMutation.isPending}>
              <Save className="h-4 w-4 me-2"/> {language === "ar" ? "حفظ" : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 gap-6">
        {isLoading && <p>Loading sequences...</p>}
        {sequences?.map((seq: any) => (
          <Card key={seq.id}>
            <CardHeader className="bg-muted/10 pb-4 border-b">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" /> {seq.name}
                  </CardTitle>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setSelectedSeqId(seq.id); setIsStepOpen(true); }}>
                    <Plus className="h-4 w-4 me-1" /> {language === "ar" ? "إضافة خطوة" : "Add Step"}
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => deleteSeqMutation.mutate(seq.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {seq.steps?.length > 0 ? (
                <div className="divide-y divide-border/50">
                  {seq.steps.map((step: any, index: number) => (
                    <div key={step.id} className="p-4 flex items-start gap-4 hover:bg-muted/5 transition-colors">
                      <div className="bg-primary/10 text-primary rounded-full h-8 w-8 flex items-center justify-center font-bold text-sm shrink-0">
                        {step.stepOrder}
                      </div>
                      <div className="flex-1 space-y-1 min-w-0">
                        <div className="flex items-center text-xs font-semibold text-muted-foreground mb-2">
                          <Clock className="h-3.5 w-3.5 me-1" />
                          {language === "ar" ? `بعد ${step.delayHours} ساعة` : `After ${step.delayHours} hours`}
                        </div>
                        <div className="bg-muted/30 p-3 rounded-lg text-sm whitespace-pre-wrap font-medium">
                          {step.messageTemplate}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  {language === "ar" ? "لا توجد خطوات في هذا التسلسل. أضف خطوة للبدء." : "No steps in this sequence. Add a step to begin."}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
