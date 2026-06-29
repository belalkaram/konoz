import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/language-context";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { authFetch, BASE } from "@/lib/api";
import { Plus, Trash2, Save, Activity, RefreshCw } from "lucide-react";

export function TiktokAutomationsTab() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    type: "dm_welcome" as "dm_welcome" | "comment_reply",
    messageTemplate: "",
    keywords: "",
    isActive: true
  });

  const { data: automations, isLoading } = useQuery({
    queryKey: ["tiktok-automations"],
    queryFn: async () => {
      const res = await authFetch(`${BASE}/api/tiktok/automations`);
      if (!res.ok) throw new Error("Failed to fetch automations");
      return res.json();
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await authFetch(`${BASE}/api/tiktok/automations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Failed to create automation");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tiktok-automations"] });
      setIsOpen(false);
      setFormData({ type: "dm_welcome", messageTemplate: "", keywords: "", isActive: true });
      toast({ title: language === "ar" ? "✅ تم الحفظ" : "✅ Saved" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number, isActive: boolean }) => {
      const res = await authFetch(`${BASE}/api/tiktok/automations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive })
      });
      if (!res.ok) throw new Error("Failed to update automation");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tiktok-automations"] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await authFetch(`${BASE}/api/tiktok/automations/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete automation");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tiktok-automations"] });
      toast({ title: language === "ar" ? "🗑️ تم الحذف" : "🗑️ Deleted" });
    }
  });

  if (isLoading) return <div className="flex justify-center p-8"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">{language === "ar" ? "الردود التلقائية" : "Automations"}</h2>
          <p className="text-muted-foreground text-sm">
            {language === "ar" 
              ? "قم بإعداد الردود التلقائية للرسائل الواردة والتعليقات على فيديوهات تيك توك."
              : "Setup auto-replies for incoming DMs and comments on your TikTok videos."}
          </p>
        </div>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 me-2"/> {language === "ar" ? "قاعدة جديدة" : "New Rule"}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{language === "ar" ? "قاعدة رد تلقائي جديدة" : "New Auto-reply Rule"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4 text-start">
              <div className="space-y-2">
                <label className="text-sm font-semibold">{language === "ar" ? "نوع القاعدة" : "Rule Type"}</label>
                <Select 
                  value={formData.type} 
                  onValueChange={(val: any) => setFormData({...formData, type: val})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dm_welcome">{language === "ar" ? "رد ترحيبي على الرسائل (DM)" : "DM Welcome Message"}</SelectItem>
                    <SelectItem value="comment_reply">{language === "ar" ? "رد تلقائي على التعليقات" : "Comment Auto-reply"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.type === "comment_reply" && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold">{language === "ar" ? "كلمات مفتاحية (مفصولة بفاصلة)" : "Keywords (comma separated)"}</label>
                  <Input 
                    value={formData.keywords} 
                    onChange={e => setFormData({...formData, keywords: e.target.value})} 
                    placeholder={language === "ar" ? "السعر, بكام, تفاصيل" : "price, how much, details"} 
                  />
                  <p className="text-xs text-muted-foreground">
                    {language === "ar" ? "اتركه فارغاً للرد على جميع التعليقات" : "Leave empty to reply to all comments"}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-semibold">{language === "ar" ? "نص الرسالة" : "Message Body"}</label>
                <Textarea 
                  value={formData.messageTemplate} 
                  onChange={e => setFormData({...formData, messageTemplate: e.target.value})} 
                  placeholder={language === "ar" ? "مرحباً! كيف يمكننا مساعدتك؟" : "Hello! How can we help you?"} 
                  rows={4} 
                />
              </div>

              <Button className="w-full" onClick={() => createMutation.mutate(formData)} disabled={createMutation.isPending || !formData.messageTemplate}>
                <Save className="h-4 w-4 me-2"/> {language === "ar" ? "حفظ" : "Save"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {automations?.map((auto: any) => (
          <Card key={auto.id} className={!auto.isActive ? "opacity-60" : ""}>
            <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  {auto.type === "dm_welcome" 
                    ? (language === "ar" ? "رسالة ترحيبية (DM)" : "DM Welcome Message") 
                    : (language === "ar" ? "رد تلقائي على تعليق" : "Comment Auto-reply")}
                </CardTitle>
                {auto.type === "comment_reply" && auto.keywords && (
                  <CardDescription className="mt-1">
                    {language === "ar" ? "الكلمات: " : "Keywords: "} 
                    <span className="font-semibold text-foreground/80">{auto.keywords}</span>
                  </CardDescription>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Switch 
                  checked={auto.isActive} 
                  onCheckedChange={(val) => updateMutation.mutate({ id: auto.id, isActive: val })}
                  disabled={updateMutation.isPending}
                />
                <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => deleteMutation.mutate(auto.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/30 p-3 rounded-lg text-sm whitespace-pre-wrap font-medium">
                {auto.messageTemplate}
              </div>
            </CardContent>
          </Card>
        ))}
        {automations?.length === 0 && (
          <div className="col-span-full p-8 text-center text-muted-foreground bg-muted/10 rounded-xl border border-dashed border-border">
            {language === "ar" ? "لا توجد ردود تلقائية مضافة." : "No automation rules found."}
          </div>
        )}
      </div>
    </div>
  );
}
