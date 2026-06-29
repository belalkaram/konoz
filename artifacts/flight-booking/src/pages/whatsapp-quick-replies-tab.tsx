import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/language-context";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus, Save, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { authFetch, BASE } from "@/lib/api";

export function WhatsappQuickRepliesTab() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    shortcut: "",
    messageBody: "",
    keywords: "",
    category: "general"
  });

  const { data: replies, isLoading } = useQuery({
    queryKey: ["whatsapp-quick-replies"],
    queryFn: async () => {
      const res = await authFetch(`${BASE}/api/whatsapp/quick-replies`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await authFetch(`${BASE}/api/whatsapp/quick-replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Failed to create");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-quick-replies"] });
      setIsOpen(false);
      setFormData({ shortcut: "", messageBody: "", keywords: "", category: "general" });
      toast({ title: language === "ar" ? "✅ تم الحفظ" : "✅ Saved" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await authFetch(`${BASE}/api/whatsapp/quick-replies/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-quick-replies"] });
      toast({ title: language === "ar" ? "🗑️ تم الحذف" : "🗑️ Deleted" });
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">{language === "ar" ? "الردود السريعة" : "Quick Replies"}</h2>
          <p className="text-muted-foreground text-sm">
            {language === "ar" 
              ? "قم بإعداد ردود جاهزة لاستخدامها في الشات عبر الاختصار (/) أو الرد الآلي عبر الكلمات المفتاحية."
              : "Setup canned responses to use in chat via (/) or auto-reply via keywords."}
          </p>
        </div>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 me-2"/> {language === "ar" ? "إضافة رد" : "Add Reply"}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{language === "ar" ? "رد سريع جديد" : "New Quick Reply"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4 text-start">
              <div className="space-y-2">
                <label className="text-sm font-semibold">{language === "ar" ? "الاختصار (بدون /)" : "Shortcut (without /)"}</label>
                <Input value={formData.shortcut} onChange={e => setFormData({...formData, shortcut: e.target.value})} placeholder="e.g. welcome" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">{language === "ar" ? "نص الرسالة" : "Message Body"}</label>
                <Textarea value={formData.messageBody} onChange={e => setFormData({...formData, messageBody: e.target.value})} placeholder="اهلا بك {{customer_name}} في شركتنا..." rows={4} />
                <p className="text-xs text-muted-foreground">Variables: {"{{customer_name}}, {{phone}}"}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">{language === "ar" ? "كلمات مفتاحية للرد الآلي (مفصولة بفاصلة)" : "Auto-reply keywords (comma separated)"}</label>
                <Input value={formData.keywords} onChange={e => setFormData({...formData, keywords: e.target.value})} placeholder="السعر, التفاصيل, بكام" />
              </div>
              <Button className="w-full" onClick={() => createMutation.mutate(formData)} disabled={createMutation.isPending}>
                <Save className="h-4 w-4 me-2"/> {language === "ar" ? "حفظ" : "Save"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead>{language === "ar" ? "الاختصار" : "Shortcut"}</TableHead>
                <TableHead>{language === "ar" ? "الرسالة" : "Message"}</TableHead>
                <TableHead>{language === "ar" ? "كلمات مفتاحية" : "Keywords"}</TableHead>
                <TableHead>{language === "ar" ? "مرات الاستخدام" : "Usage Count"}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={5} className="text-center py-4">Loading...</TableCell></TableRow>}
              {replies?.map((reply: any) => (
                <TableRow key={reply.id}>
                  <TableCell className="font-mono font-bold text-primary">/{reply.shortcut}</TableCell>
                  <TableCell className="max-w-xs truncate">{reply.messageBody}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{reply.keywords || "-"}</TableCell>
                  <TableCell>{reply.usageCount}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMutation.mutate(reply.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {replies?.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No quick replies found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
