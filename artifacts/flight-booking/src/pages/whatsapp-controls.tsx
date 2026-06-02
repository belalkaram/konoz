import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Send, Clock, Layers, FileText, Play, CheckCircle, Users, Filter, Pause, CheckCircle2 } from "lucide-react";
import { authFetch, BASE } from "@/lib/api";
import * as XLSX from "xlsx";
import { useLocation, useRoute } from "wouter";
import { useLanguage } from "@/contexts/language-context";
import WhatsappSettings from "./whatsapp-settings";
import WhatsappRoutingTab from "./whatsapp-routing-tab";

export default function WhatsappControls() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/whatsapp-controls/:tab");
  const currentTab = match && params?.tab ? params.tab : "campaigns";

  const { toast } = useToast();
  const { t, language, isRtl } = useLanguage();
  const queryClient = useQueryClient();
  const [numbers, setNumbers] = useState<string[]>([]);
  const [messageTemplate, setMessageTemplate] = useState("");
  const [timeGapMin, setTimeGapMin] = useState(5);
  const [timeGapMax, setTimeGapMax] = useState(10);
  const [batchSize, setBatchSize] = useState(10);
  const [campaignName, setCampaignName] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [checkingNumbers, setCheckingNumbers] = useState(false);
  const [filteredNumbers, setFilteredNumbers] = useState<string[]>([]);

  // ── Fetch Campaigns ────────────────────────────────────────────────────────
  const { data: campaignsData, isLoading: campaignsLoading } = useQuery({
    queryKey: ["whatsapp-campaigns"],
    queryFn: async () => {
      const res = await authFetch(`${BASE}/api/whatsapp/campaigns`);
      if (!res.ok) throw new Error("Failed to fetch campaigns");
      return res.json() as Promise<{ campaigns: any[] }>;
    }
  });

  // ── Fetch Groups ───────────────────────────────────────────────────────────
  const { data: groupsData, isLoading: groupsLoading } = useQuery({
    queryKey: ["whatsapp-groups"],
    queryFn: async () => {
      const res = await authFetch(`${BASE}/api/whatsapp/groups`);
      if (!res.ok) throw new Error("Failed to fetch groups");
      return res.json() as Promise<{ groups: any }>;
    }
  });

  // ── Fetch Contacts Extract ─────────────────────────────────────────────────
  const { data: contactsData, isLoading: contactsLoading, refetch: refetchContacts } = useQuery({
    queryKey: ["whatsapp-all-contacts"],
    queryFn: async () => {
      const res = await authFetch(`${BASE}/api/whatsapp/contacts/extract`);
      if (!res.ok) throw new Error("Failed to fetch contacts");
      return res.json() as Promise<{ success: boolean; total: number; contacts: any[]; unresolved: any[] }>;
    }
  });

  // ── Create Campaign Mutation ───────────────────────────────────────────────
  const createCampaignMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`${BASE}/api/whatsapp/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: campaignName,
          messageTemplate,
          numbers: filteredNumbers.length > 0 ? filteredNumbers : numbers,
          timeGapMin,
          timeGapMax,
          batchSize,
          scheduledAt: scheduledAt || undefined
        })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as any).message || "Failed to create campaign");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: language === "ar" ? "✅ تم إنشاء الحملة بنجاح!" : "✅ Campaign created!" });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-campaigns"] });
      setCampaignName("");
      setMessageTemplate("");
      setNumbers([]);
      setFilteredNumbers([]);
      setScheduledAt("");
    },
    onError: (err: any) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    }
  });

  // ── Resume Campaign Mutation ───────────────────────────────────────────────
  const resumeCampaignMutation = useMutation({
    mutationFn: async (campaignId: number) => {
      const res = await authFetch(`${BASE}/api/whatsapp/campaigns/${campaignId}/resume`, {
        method: "POST"
      });
      if (!res.ok) throw new Error("Failed to resume campaign");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: language === "ar" ? "✅ تم استئناف الحملة!" : "✅ Campaign resumed!" });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-campaigns"] });
    },
    onError: (err: any) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    }
  });

  // ── Pause Campaign Mutation ────────────────────────────────────────────────
  const pauseCampaignMutation = useMutation({
    mutationFn: async (campaignId: number) => {
      const res = await authFetch(`${BASE}/api/whatsapp/campaigns/${campaignId}/pause`, {
        method: "POST"
      });
      if (!res.ok) throw new Error("Failed to pause campaign");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: language === "ar" ? "⏸️ تم إيقاف الحملة مؤقتاً!" : "⏸️ Campaign paused!" });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-campaigns"] });
    },
    onError: (err: any) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    }
  });

  // ── File Upload Handler ────────────────────────────────────────────────────
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        
        // Assume first column contains numbers
        const parsedNumbers = data
          .map(row => row[0])
          .filter(Boolean)
          .map(n => String(n).trim().replace(/[^0-9]/g, '')) // Keep only digits
          .filter(n => n.length >= 10); // Basic validation
          
        setNumbers(parsedNumbers);
        setFilteredNumbers([]); // Reset filter
        toast({ title: language === "ar" ? `✅ تم تحميل ${parsedNumbers.length} رقم بنجاح` : `✅ Loaded ${parsedNumbers.length} numbers successfully` });
      } catch (err) {
        toast({ title: language === "ar" ? "❌ فشل قراءة الملف" : "❌ Error reading file", variant: "destructive" });
      }
    };
    reader.readAsBinaryString(file);
  };

  // ── Filter Numbers Handler ─────────────────────────────────────────────────
  const handleFilterNumbers = async () => {
    if (numbers.length === 0) {
      toast({ title: language === "ar" ? "⚠️ يرجى رفع ملف يحتوي على أرقام أولاً" : "⚠️ Please upload a file with numbers first" });
      return;
    }

    setCheckingNumbers(true);
    try {
      const res = await authFetch(`${BASE}/api/whatsapp/check-numbers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numbers })
      });
      
      if (!res.ok) throw new Error("Failed to check numbers");
      const data = await res.json();
      
      // Evolution API returns array of results
      const validNumbers = data
        .filter((item: any) => item.exists)
        .map((item: any) => item.jid.split('@')[0]);
        
      setFilteredNumbers(validNumbers);
      toast({ title: language === "ar" ? `🔍 تمت التصفية. الصالحة: ${validNumbers.length} من أصل ${numbers.length}` : `🔍 Numbers filtered. Valid: ${validNumbers.length} out of ${numbers.length}` });
    } catch (err: any) {
      toast({ title: language === "ar" ? "❌ خطأ في فحص وتصفية الأرقام" : "❌ Error filtering numbers", description: err.message, variant: "destructive" });
    } finally {
      setCheckingNumbers(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6 animate-in fade-in zoom-in-95 duration-500">
      <h1 className="text-3xl font-bold text-foreground mb-6 text-start">{t("common.whatsappControls")}</h1>

      <Tabs value={currentTab} onValueChange={(val) => setLocation(`/whatsapp-controls/${val}`)} className="space-y-6">
        <TabsList className="flex flex-col sm:flex-row h-auto w-full max-w-4xl mx-auto gap-2 bg-muted/50 p-1 rounded-lg">
          <TabsTrigger value="campaigns" className="text-sm font-medium w-full">{language === "ar" ? "الحملات الجماعية" : "Bulk Campaigns"}</TabsTrigger>
          <TabsTrigger value="routing" className="text-sm font-medium w-full">{language === "ar" ? "توزيع المحادثات" : "Lead Routing"}</TabsTrigger>
          <TabsTrigger value="reports" className="text-sm font-medium w-full">{t("reports.title")}</TabsTrigger>
          <TabsTrigger value="groups" className="text-sm font-medium w-full">{language === "ar" ? "إدارة المجموعات" : "Group Management"}</TabsTrigger>
          <TabsTrigger value="contacts" className="text-sm font-medium w-full">{language === "ar" ? "سحب جهات الاتصال" : "Contacts Extract"}</TabsTrigger>
          <TabsTrigger value="settings" className="text-sm font-medium w-full">{t("common.settings")}</TabsTrigger>
        </TabsList>

        {/* ── Campaigns Tab ────────────────────────────────────────────────── */}
        <TabsContent value="campaigns" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-start">
            
            {/* Create Campaign Card */}
            <Card className="bg-card border-border shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Send className="h-5 w-5 text-primary" />
                  {language === "ar" ? "إنشاء حملة إرسال جديدة" : "Create New Campaign"}
                </CardTitle>
                <CardDescription>
                  {language === "ar" ? "ارفع ملف الأرقام واكتب نص الرسالة للإرسال الجماعي." : "Upload numbers and write your message to send in bulk."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                
                {/* 1. File Upload */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">{language === "ar" ? "رفع ملف إكسيل بالأرقام" : "Upload Excel with Numbers"}</label>
                  <div className="flex items-center gap-2">
                    <Input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="cursor-pointer" />
                    <Button variant="outline" size="icon" title={language === "ar" ? "رفع ملف" : "Upload File"}>
                      <Upload className="h-4 w-4" />
                    </Button>
                  </div>
                  {numbers.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {language === "ar" ? `تم تحميل ${numbers.length} رقم.` : `Loaded ${numbers.length} numbers.`}
                      {filteredNumbers.length > 0 && (language === "ar" ? ` (المصفى: ${filteredNumbers.length} صالحة)` : ` (Filtered: ${filteredNumbers.length} valid)`)}
                    </p>
                  )}
                </div>

                {/* 2. Filter Numbers */}
                <div className="space-y-2">
                  <Button 
                    variant="outline" 
                    className="w-full" 
                    onClick={handleFilterNumbers}
                    disabled={numbers.length === 0 || checkingNumbers}
                  >
                    {checkingNumbers ? <Loader2 className="mr-2 rtl:mr-0 rtl:ml-2 h-4 w-4 animate-spin" /> : <Filter className="mr-2 rtl:mr-0 rtl:ml-2 h-4 w-4" />}
                    {language === "ar" ? "فحص وتصفية الأرقام (التحقق من وجود واتساب)" : "Filter Numbers (Check WhatsApp existence)"}
                  </Button>
                </div>

                {/* 3. Campaign Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{language === "ar" ? "اسم الحملة" : "Campaign Name"}</label>
                    <Input 
                      placeholder={language === "ar" ? "مثال: حملة رمضان" : "e.g. Ramadan Campaign"} 
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-1">
                      <Clock className="h-4 w-4" /> {language === "ar" ? "وقت الجدولة (اختياري)" : "Scheduled Time (Optional)"}
                    </label>
                    <Input 
                      type="datetime-local" 
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">{language === "ar" ? "نص الرسالة" : "Message Template"}</label>
                  <Textarea 
                    placeholder={language === "ar" ? "اكتب رسالتك هنا..." : "Type your message here..."} 
                    rows={5}
                    value={messageTemplate}
                    onChange={(e) => setMessageTemplate(e.target.value)}
                  />
                </div>

                {/* Settings */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-1">
                      <Clock className="h-4 w-4" /> {language === "ar" ? "الفارق الزمني (ثواني)" : "Time Gap (Seconds)"}
                    </label>
                    <div className="flex items-center gap-2">
                      <Input type="number" placeholder="Min" value={timeGapMin} onChange={(e) => setTimeGapMin(parseInt(e.target.value))} />
                      <span>{language === "ar" ? "إلى" : "to"}</span>
                      <Input type="number" placeholder="Max" value={timeGapMax} onChange={(e) => setTimeGapMax(parseInt(e.target.value))} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-1">
                      <Layers className="h-4 w-4" /> {language === "ar" ? "حجم الدفعة" : "Batch Size"}
                    </label>
                    <Input type="number" value={batchSize} onChange={(e) => setBatchSize(parseInt(e.target.value))} />
                  </div>
                </div>

                <Button 
                  className="w-full bg-primary hover:bg-primary/90" 
                  onClick={() => createCampaignMutation.mutate()}
                  disabled={createCampaignMutation.isPending || numbers.length === 0 || !messageTemplate || !campaignName}
                >
                  {createCampaignMutation.isPending ? <Loader2 className="mr-2 rtl:mr-0 rtl:ml-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 rtl:mr-0 rtl:ml-2 h-4 w-4" />}
                  {language === "ar" ? "بدء إرسال الحملة" : "Start Campaign"}
                </Button>

              </CardContent>
            </Card>

            {/* Campaign Summary / Quick Notes */}
            <Card className="bg-card border-border shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <FileText className="h-5 w-5 text-primary" />
                  {language === "ar" ? "التعليمات والملاحظات" : "Instructions & Notes"}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>{language === "ar" ? "• يجب أن يحتوي ملف الإكسيل على الأرقام في العمود الأول." : "• The Excel file must contain numbers in the first column."}</p>
                <p>{language === "ar" ? "• يُنصح باستخدام فواصل زمنية كبيرة (مثلاً من 5 إلى 10 ثوانٍ) لتفادي حظر الرقم." : "• It is recommended to use large time gaps (e.g., 5 to 10 seconds) to avoid number blocking."}</p>
                <p>{language === "ar" ? "• ميزة الفحص تتحقق من وجود حساب واتساب للرقم قبل الإرسال لتوفير الوقت وحماية الحساب." : "• The filter feature checks if the number has a WhatsApp account before sending."}</p>
                <p>{language === "ar" ? "• ميزة الدفعات تقوم بإيقاف الإرسال مؤقتاً بعد عدد معين من الرسائل لإراحة حساب الواتساب الخاص بك." : "• The batch feature pauses sending after a certain number of messages to rest the account."}</p>
              </CardContent>
            </Card>

          </div>
        </TabsContent>

        {/* ── Reports Tab ──────────────────────────────────────────────────── */}
        <TabsContent value="reports" className="space-y-6">
          <Card className="bg-card border-border shadow-sm text-start">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <FileText className="h-5 w-5 text-primary" />
                {language === "ar" ? "تقارير الحملات المرسلة" : "Campaign Reports"}
              </CardTitle>
              <CardDescription>
                {language === "ar" ? "متابعة حالة الإرسال والتقارير للحملات الجارية والسابقة." : "Monitor sending status and reports for current and past campaigns."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {campaignsLoading ? (
                <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="min-w-[700px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{language === "ar" ? "اسم الحملة" : "Campaign Name"}</TableHead>
                      <TableHead>{t("common.status")}</TableHead>
                      <TableHead>{language === "ar" ? "الإجمالي" : "Total"}</TableHead>
                      <TableHead>{language === "ar" ? "المرسل" : "Sent"}</TableHead>
                      <TableHead>{language === "ar" ? "الفاشل" : "Failed"}</TableHead>
                      <TableHead className="text-end">{t("common.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaignsData?.campaigns.map((camp: any) => (
                      <TableRow key={camp.id}>
                        <TableCell className="font-medium">{camp.name}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                            camp.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            camp.status === 'running' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {camp.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5" />}
                            {camp.status === 'running' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            {camp.status === 'paused' && <Pause className="w-3.5 h-3.5" />}
                            {camp.status === 'completed' ? (language === "ar" ? "مكتملة" : "Completed") :
                             camp.status === 'running' ? (language === "ar" ? "جارية" : "Running") : (language === "ar" ? "متوقفة مؤقتاً" : "Paused")}
                          </span>
                        </TableCell>
                        <TableCell>{camp.total}</TableCell>
                        <TableCell className="text-emerald-600 font-semibold">{camp.sent}</TableCell>
                        <TableCell className="text-destructive font-semibold">{camp.failed}</TableCell>
                        <TableCell className="text-end">
                          <div className="flex justify-end items-center gap-2">
                            {camp.status === 'paused' && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                                onClick={() => resumeCampaignMutation.mutate(camp.id)}
                                disabled={resumeCampaignMutation.isPending}
                              >
                                <Play className="mr-1 rtl:mr-0 rtl:ml-1 h-3.5 w-3.5" /> {language === "ar" ? "استئناف" : "Resume"}
                              </Button>
                            )}
                            {camp.status === 'running' && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 border-amber-200"
                                onClick={() => pauseCampaignMutation.mutate(camp.id)}
                                disabled={pauseCampaignMutation.isPending}
                              >
                                <Pause className="mr-1 rtl:mr-0 rtl:ml-1 h-3.5 w-3.5" /> {language === "ar" ? "إيقاف مؤقت" : "Pause"}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {campaignsData?.campaigns.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-4">
                          {language === "ar" ? "لا توجد حملات مرسلة بعد" : "No campaigns yet"}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Routing Tab ───────────────────────────────────────────────────── */}
        <TabsContent value="routing" className="space-y-6">
          <WhatsappRoutingTab />
        </TabsContent>

        {/* ── Groups Tab ───────────────────────────────────────────────────── */}
        <TabsContent value="groups" className="space-y-6">
          <Card className="bg-card border-border shadow-sm text-start">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Users className="h-5 w-5 text-primary" />
                {language === "ar" ? "إدارة مجموعات الواتساب المشترك بها" : "Group Management"}
              </CardTitle>
              <CardDescription>
                {language === "ar" ? "عرض المجموعات التي يشترك بها رقم الواتساب المربوط وسحب أعضائها." : "View groups the account is subscribed to."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {groupsLoading ? (
                <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="min-w-[500px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{language === "ar" ? "اسم المجموعة" : "Group Name"}</TableHead>
                      <TableHead>{language === "ar" ? "معرف المجموعة (JID)" : "Identifier (JID)"}</TableHead>
                      <TableHead className="text-end">{t("common.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupsData?.groups?.map((group: any) => (
                      <TableRow key={group.id}>
                        <TableCell className="font-medium">{group.subject}</TableCell>
                        <TableCell className="font-mono text-xs">{group.id}</TableCell>
                        <TableCell className="text-end">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={async () => {
                              try {
                                toast({ title: language === "ar" ? "⏳ جاري استخراج الأعضاء..." : "⏳ Fetching members...", description: language === "ar" ? "يرجى الانتظار بينما نقوم بسحب أرقام أعضاء المجموعة." : "Please wait while we extract group members." });
                                const res = await authFetch(`${BASE}/api/whatsapp/groups/${group.id}/members/export`);
                                if (!res.ok) throw new Error("Failed to export members");
                                const data = await res.json();
                                
                                if (!data.members || data.members.length === 0) {
                                  toast({ title: language === "ar" ? "⚠️ لم يتم العثور على أعضاء" : "⚠️ No members found", description: language === "ar" ? "لا توجد أرقام هواتف صالحة في هذه المجموعة." : "No valid phone numbers could be extracted from this group." });
                                  return;
                                }

                                const exportData = data.members.map((m: any) => ({
                                  [language === "ar" ? "اسم المجموعة" : "Group Name"]: m.groupName,
                                  [language === "ar" ? "اسم العضو" : "Member Name"]: m.memberName || "",
                                  [language === "ar" ? "رقم الهاتف" : "Phone Number"]: m.phone,
                                  [language === "ar" ? "الصلاحية" : "Role"]: m.role,
                                  [language === "ar" ? "الحالة" : "Status"]: m.status
                                }));

                                const ws = XLSX.utils.json_to_sheet(exportData);
                                const wb = XLSX.utils.book_new();
                                XLSX.utils.book_append_sheet(wb, ws, "Members");
                                XLSX.writeFile(wb, `${group.subject}_members.xlsx`);
                                toast({ title: language === "ar" ? `✅ تم تصدير ${data.members.length} عضو بنجاح` : `✅ Exported ${data.members.length} members successfully` });
                              } catch (err: any) {
                                toast({ title: language === "ar" ? "❌ فشل تصدير الأعضاء" : "❌ Export failed", description: err.message, variant: "destructive" });
                              }
                            }}
                          >
                            <Upload className="h-4 w-4 mr-1 rtl:mr-0 rtl:ml-1" /> {language === "ar" ? "تصدير الأعضاء إكسيل" : "Export Members"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!groupsData?.groups || groupsData.groups.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                          {language === "ar" ? "لم يتم العثور على مجموعات أو لم يتم تحميلها بعد" : "No groups found or not loaded yet"}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Contacts Extract Tab ─────────────────────────────────────────── */}
        <TabsContent value="contacts" className="space-y-6">
          <Card className="bg-card border-border shadow-sm text-start">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Users className="h-5 w-5 text-primary" />
                {language === "ar" ? "جميع جهات اتصال الواتساب" : "All WhatsApp Contacts"}
              </CardTitle>
              <CardDescription>
                {language === "ar" ? "عرض جميع الدردشات وجهات الاتصال المسحوبة من حساب الواتساب الخاص بك." : "View all chats and contacts from your WhatsApp account."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {contactsLoading ? (
                <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap justify-between items-center bg-muted/30 p-3 rounded-lg border border-border/50 gap-4">
                    <div>
                      <h3 className="font-semibold text-foreground">{language === "ar" ? `إجمالي جهات الاتصال المسحوبة: ${contactsData?.total || 0}` : `Total Extracted: ${contactsData?.total || 0}`}</h3>
                      <p className="text-xs text-muted-foreground">{language === "ar" ? "جهات الاتصال الفريدة التي تم استخراجها من الدردشات وقائمة الأسماء." : "Unique contacts found in your chats and contacts list."}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="secondary"
                        onClick={() => refetchContacts()}
                      >
                        {language === "ar" ? "تحديث السحب" : "Refresh Extract"}
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => {
                          if (!contactsData?.contacts?.length) {
                            toast({ title: language === "ar" ? "⚠️ لا توجد جهات اتصال لتصديرها" : "⚠️ No contacts to export" });
                            return;
                          }
                          const ws = XLSX.utils.json_to_sheet(contactsData.contacts.map((c: any) => ({
                            [language === "ar" ? "الاسم" : "Name"]: c.name || "",
                            [language === "ar" ? "رقم الهاتف" : "Phone Number"]: c.phone,
                            [language === "ar" ? "المصدر" : "Source"]: c.source,
                            [language === "ar" ? "الحالة" : "Status"]: c.status
                          })));
                          const wb = XLSX.utils.book_new();
                          XLSX.utils.book_append_sheet(wb, ws, "Contacts");
                          XLSX.writeFile(wb, "whatsapp_contacts_extract.xlsx");
                        }}
                      >
                        <Upload className="h-4 w-4 mr-2 rtl:mr-0 rtl:ml-2" /> {language === "ar" ? "تصدير إلى إكسيل" : "Export to Excel"}
                      </Button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <Table className="min-w-[700px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("common.name")}</TableHead>
                          <TableHead>{t("common.phone")}</TableHead>
                          <TableHead>{language === "ar" ? "المصدر" : "Source"}</TableHead>
                          <TableHead>{t("common.status")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contactsData?.contacts?.map((contact: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{contact.name || "-"}</TableCell>
                            <TableCell className="font-mono text-sm">{contact.phone}</TableCell>
                            <TableCell className="capitalize">{contact.source}</TableCell>
                            <TableCell>
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-emerald-50 text-emerald-700 border-emerald-200">
                                {contact.status}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                        {(!contactsData?.contacts || contactsData.contacts.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                              {language === "ar" ? "لم يتم سحب جهات اتصال بعد. تأكد من ربط الواتساب الخاص بك." : "No contacts extracted yet. Ensure your WhatsApp is connected."}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <WhatsappSettings />
        </TabsContent>

      </Tabs>
    </div>
  );
}
