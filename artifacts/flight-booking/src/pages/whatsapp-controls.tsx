import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Send, Clock, Layers, FileText, Play, Users, Filter, Pause, CheckCircle2, AlertTriangle, Trash2, Plus, Smile, Bold, Italic, Code, ChevronLeft, ChevronRight, Smartphone, Settings, Zap, MessageSquare, Activity } from "lucide-react";
import { authFetch, BASE } from "@/lib/api";
import * as XLSX from "xlsx";
import { useLocation, useRoute } from "wouter";
import { useLanguage } from "@/contexts/language-context";
import WhatsappSettings from "./whatsapp-settings";
import WhatsappRoutingTab from "./whatsapp-routing-tab";
import { PageHeader } from "@/components/page-header";
import { WhatsappQuickRepliesTab } from "./whatsapp-quick-replies-tab";
import { WhatsappAutomationsTab } from "./whatsapp-automations-tab";

export default function WhatsappControls() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/whatsapp-controls/:tab");
  const currentTab = match && params?.tab ? params.tab : "campaigns";

  const { toast } = useToast();
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();

  // ── Campaign Inputs states ────────────────────────────────────────────────
  const [numbers, setNumbers] = useState<string[]>([]);
  const [manualNumbers, setManualNumbers] = useState("");
  const [messageTemplates, setMessageTemplates] = useState<string[]>([""]);
  const [timeGapMin, setTimeGapMin] = useState(5);
  const [timeGapMax, setTimeGapMax] = useState(10);
  const [batchSize, setBatchSize] = useState(10);
  const [campaignName, setCampaignName] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [checkingNumbers, setCheckingNumbers] = useState(false);
  const [filteredNumbers, setFilteredNumbers] = useState<string[]>([]);
  const [maxMessages, setMaxMessages] = useState<number>(150);

  // ── Preview states ────────────────────────────────────────────────────────
  const [previewVariantIdx, setPreviewVariantIdx] = useState(0);
  const [activeTextareaIdx, setActiveTextareaIdx] = useState<number>(0);

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

  // Parse manual numbers text to clean digits
  const getParsedManualNumbers = () => {
    if (!manualNumbers) return [];
    return manualNumbers
      .split(/[\s,;\n]+/)
      .map(n => n.trim().replace(/[^0-9]/g, ""))
      .filter(n => n.length >= 8);
  };

  // Combine Excel and Manual list
  const getFinalNumbersList = () => {
    const manual = getParsedManualNumbers();
    return Array.from(new Set([...numbers, ...manual]));
  };

  const finalNumbersList = getFinalNumbersList();

  // Reset filtered numbers if inputs change to prevent logic mismatches
  const handleNumbersChange = (newNumbers: string[]) => {
    setNumbers(newNumbers);
    setFilteredNumbers([]);
  };

  const handleManualNumbersChange = (val: string) => {
    setManualNumbers(val);
    setFilteredNumbers([]);
  };

  // ── Create Campaign Mutation ───────────────────────────────────────────────
  const createCampaignMutation = useMutation({
    mutationFn: async () => {
      const finalRecipients = filteredNumbers.length > 0 ? filteredNumbers : finalNumbersList;
      const res = await authFetch(`${BASE}/api/whatsapp/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: campaignName,
          messageTemplate: messageTemplates.filter(t => t.trim()), // array of strings
          numbers: finalRecipients,
          timeGapMin,
          timeGapMax,
          batchSize,
          scheduledAt: scheduledAt || undefined,
          maxMessages: Number(maxMessages)
        })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as any).message || "Failed to create campaign");
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data?.truncated) {
        toast({
          title: language === "ar" 
            ? `✅ تم إنشاء الحملة — تم الإرسال لـ ${data.acceptedCount} رقم فقط` 
            : `✅ Campaign created — Sending to ${data.acceptedCount} numbers only`,
          description: language === "ar"
            ? `تم تجاهل ${data.originalCount - data.acceptedCount} رقم تجاوزت الحد المسموح`
            : `${data.originalCount - data.acceptedCount} numbers over the limit were ignored`,
        });
      } else {
        toast({ title: language === "ar" ? "✅ تم إنشاء الحملة بنجاح!" : "✅ Campaign created!" });
      }
      queryClient.invalidateQueries({ queryKey: ["whatsapp-campaigns"] });
      setCampaignName("");
      setMessageTemplates([""]);
      setNumbers([]);
      setManualNumbers("");
      setFilteredNumbers([]);
      setScheduledAt("");
      setMaxMessages(150);
      setPreviewVariantIdx(0);
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
        
        const parsedNumbers = data
          .map(row => row[0])
          .filter(Boolean)
          .map(n => String(n).trim().replace(/[^0-9]/g, ''))
          .filter(n => n.length >= 8);
          
        handleNumbersChange(parsedNumbers);
        toast({ title: language === "ar" ? `✅ تم تحميل ${parsedNumbers.length} رقم بنجاح` : `✅ Loaded ${parsedNumbers.length} numbers successfully` });
      } catch (err) {
        toast({ title: language === "ar" ? "❌ فشل قراءة الملف" : "❌ Error reading file", variant: "destructive" });
      }
    };
    reader.readAsBinaryString(file);
  };

  // ── Filter Numbers Handler ─────────────────────────────────────────────────
  const handleFilterNumbers = async () => {
    const targets = finalNumbersList;
    if (targets.length === 0) {
      toast({ title: language === "ar" ? "⚠️ يرجى إضافة أرقام أولاً" : "⚠️ Please add numbers first" });
      return;
    }

    setCheckingNumbers(true);
    try {
      const res = await authFetch(`${BASE}/api/whatsapp/check-numbers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numbers: targets })
      });
      
      if (!res.ok) throw new Error("Failed to check numbers");
      const data = await res.json();
      
      const validNumbers = data
        .filter((item: any) => item.exists)
        .map((item: any) => item.jid.split('@')[0]);
        
      setFilteredNumbers(validNumbers);
      toast({ title: language === "ar" ? `🔍 تمت التصفية. الصالحة: ${validNumbers.length} من أصل ${targets.length}` : `🔍 Numbers filtered. Valid: ${validNumbers.length} out of ${targets.length}` });
    } catch (err: any) {
      toast({ title: language === "ar" ? "❌ خطأ في فحص وتصفية الأرقام" : "❌ Error filtering numbers", description: err.message, variant: "destructive" });
    } finally {
      setCheckingNumbers(false);
    }
  };

  // ── Formatting Utilities ───────────────────────────────────────────────────
  const insertFormatting = (syntax: string) => {
    const updated = [...messageTemplates];
    const current = updated[activeTextareaIdx] || "";
    updated[activeTextareaIdx] = current + syntax;
    setMessageTemplates(updated);
  };

  const formatWhatsAppText = (text: string) => {
    if (!text) return "";
    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br />");
    
    // Bold *text*
    html = html.replace(/\*(.*?)\*/g, "<strong>$1</strong>");
    // Italic _text_
    html = html.replace(/_(.*?)_/g, "<em>$1</em>");
    // Strikethrough ~text~
    html = html.replace(/~(.*?)~/g, "<span class='line-through'>$1</span>");
    // Monospace `text`
    html = html.replace(/`(.*?)`/g, "<code class='bg-muted px-1.5 py-0.5 rounded font-mono text-xs text-foreground/90 border border-border/50'>$1</code>");
    
    return html;
  };

  // ── Navigation configuration ───────────────────────────────────────────────
  const navItems = [
    {
      value: "campaigns",
      labelAr: "الحملات الجماعية",
      labelEn: "Bulk Campaigns",
      icon: Send,
      color: "text-blue-500 bg-blue-500/10",
      activeColor: "bg-blue-500 text-white",
      descAr: "إنشاء وجدولة الحملات التسويقية والرسائل الدورية.",
      descEn: "Create, schedule, and execute broadcast message campaigns."
    },
    {
      value: "routing",
      labelAr: "توزيع المحادثات",
      labelEn: "Lead Routing",
      icon: Filter,
      color: "text-emerald-500 bg-emerald-500/10",
      activeColor: "bg-emerald-500 text-white",
      descAr: "توزيع المحادثات الواردة تلقائياً على أعضاء الفريق.",
      descEn: "Distribute incoming messages dynamically among agents."
    },
    {
      value: "reports",
      labelAr: "تقارير الحملات",
      labelEn: "Reports",
      icon: FileText,
      color: "text-purple-500 bg-purple-500/10",
      activeColor: "bg-purple-500 text-white",
      descAr: "عرض نسب تسليم الرسائل والتقارير التفصيلية.",
      descEn: "View message delivery statistics and delivery audits."
    },
    {
      value: "groups",
      labelAr: "إدارة المجموعات",
      labelEn: "Groups",
      icon: Users,
      color: "text-orange-500 bg-orange-500/10",
      activeColor: "bg-orange-500 text-white",
      descAr: "سحب وتصدير أرقام أعضاء مجموعات الواتساب.",
      descEn: "View groups and extract list of active members."
    },
    {
      value: "contacts",
      labelAr: "سحب جهات الاتصال",
      labelEn: "Extract Contacts",
      icon: Upload,
      color: "text-cyan-500 bg-cyan-500/10",
      activeColor: "bg-cyan-500 text-white",
      descAr: "استخراج جميع جهات الاتصال النشطة بالواتساب.",
      descEn: "Extract and sync all active WhatsApp contacts list."
    },
    {
      value: "settings",
      labelAr: "الإعدادات والتارجت",
      labelEn: "Settings & Targets",
      icon: Settings,
      color: "text-pink-500 bg-pink-500/10",
      activeColor: "bg-pink-500 text-white",
      descAr: "إعداد ربط الأجهزة، الإشعارات، وتحديد التارجت.",
      descEn: "Link accounts, manage alerts, and set monthly targets."
    },
    {
      value: "quick-replies",
      labelAr: "الردود السريعة",
      labelEn: "Quick Replies",
      icon: Layers,
      color: "text-blue-500 bg-blue-500/10",
      activeColor: "bg-blue-500 text-white",
      descAr: "إدارة الردود الجاهزة والرد الآلي.",
      descEn: "Manage canned responses and auto-replies."
    },
    {
      value: "automations",
      labelAr: "المتابعة الآلية",
      labelEn: "Automations",
      icon: Activity,
      color: "text-emerald-500 bg-emerald-500/10",
      activeColor: "bg-emerald-500 text-white",
      descAr: "تسلسلات المتابعة الذكية.",
      descEn: "Smart follow-up sequences."
    }
  ];

  const travelEmojis = ["✈️", "🌴", "🏨", "📞", "💬", "🌟", "🎉", "🏷️", "🗺️", "🧳", "☀️", "⛱️"];

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6 animate-in fade-in zoom-in-95 duration-500">
      <PageHeader
        title={t("common.whatsappControls")}
        description={language === "ar" ? "أدوات متقدمة للتحكم في حساب الواتساب وإرسال الحملات وتوزيع العملاء تلقائياً." : "Advanced tools for WhatsApp account management, bulk campaigns, and lead routing."}
        icon={Layers}
      />

      {/* Modern responsive layout container */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        
        {/* Navigation Sidebar Panel (Visible on large screens) */}
        <aside className="hidden lg:block lg:col-span-1 space-y-3 sticky top-6">
          <Card className="bg-card border-border shadow-sm overflow-hidden p-3 space-y-2">
            <div className="px-3 py-2 border-b border-border/60">
              <h3 className="font-semibold text-sm text-foreground/80 uppercase tracking-wider">
                {language === "ar" ? "لوحة التحكم" : "Control Menu"}
              </h3>
            </div>
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.value;
                return (
                  <button
                    key={item.value}
                    onClick={() => setLocation(`/whatsapp-controls/${item.value}`)}
                    className={`w-full flex items-start gap-3 p-3 rounded-lg text-start transition-all duration-200 border ${
                      isActive 
                        ? "bg-primary/5 border-primary/20 text-primary shadow-sm" 
                        : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <div className={`p-2 rounded-md shrink-0 transition-colors ${isActive ? item.activeColor : item.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {language === "ar" ? item.labelAr : item.labelEn}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {language === "ar" ? item.descAr : item.descEn}
                      </p>
                    </div>
                  </button>
                );
              })}
            </nav>
          </Card>
        </aside>

        {/* Mobile Horizontal Scrolling Tabs (Visible only on mobile/tablet) */}
        <div className="block lg:hidden w-full -mx-4 px-4 overflow-x-auto scrollbar-none snap-x flex flex-row gap-2 pb-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.value;
            return (
              <button
                key={item.value}
                onClick={() => setLocation(`/whatsapp-controls/${item.value}`)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold whitespace-nowrap border shrink-0 transition-all snap-start ${
                  isActive 
                    ? "bg-primary border-primary text-primary-foreground shadow-md" 
                    : "bg-card border-border text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{language === "ar" ? item.labelAr : item.labelEn}</span>
              </button>
            );
          })}
        </div>

        {/* Main Workspace Area */}
        <main className="col-span-1 lg:col-span-3 space-y-6">

          {/* ── Campaigns Tab ────────────────────────────────────────────────── */}
          {currentTab === "campaigns" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start text-start">
                
                {/* Campaign Form Panel */}
                <div className="xl:col-span-3 space-y-6">
                  <Card className="bg-card border-border shadow-sm">
                    <CardHeader className="pb-4 border-b border-border/50">
                      <CardTitle className="flex items-center gap-2 text-xl font-bold">
                        <Send className="h-5 w-5 text-primary" />
                        {language === "ar" ? "حملة إرسال جديدة" : "New Message Campaign"}
                      </CardTitle>
                      <CardDescription>
                        {language === "ar" ? "أدخل الأرقام يدويًا أو عبر إكسل، واكتب عدة صِيغ للرسائل للتدوير التلقائي." : "Add numbers, write rotated messages, and configure limits."}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                      
                      {/* Campaign Name */}
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground/80">{language === "ar" ? "اسم الحملة" : "Campaign Name"}</label>
                        <Input 
                          placeholder={language === "ar" ? "مثال: عرض الصيف السياحي 🌴" : "e.g. Summer Travel Offer"} 
                          value={campaignName}
                          onChange={(e) => setCampaignName(e.target.value)}
                          className="w-full"
                        />
                      </div>

                      {/* Phone Numbers Input Options */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-foreground/80">{language === "ar" ? "أرقام المستلمين" : "Recipient Phone Numbers"}</h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Option 1: Excel Upload */}
                          <div className="p-4 rounded-xl border border-border bg-muted/10 space-y-3">
                            <span className="text-xs font-bold text-muted-foreground tracking-wide uppercase">
                              {language === "ar" ? "الخيار الأول: ملف إكسيل" : "Option 1: Excel Upload"}
                            </span>
                            <div className="flex items-center gap-2">
                              <Input 
                                type="file" 
                                accept=".xlsx, .xls" 
                                onChange={handleFileUpload} 
                                className="cursor-pointer bg-card" 
                              />
                              <Button variant="outline" size="icon" className="shrink-0" title={language === "ar" ? "ملف إكسيل" : "Excel File"}>
                                <Upload className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          {/* Option 2: Manual Numbers */}
                          <div className="p-4 rounded-xl border border-border bg-muted/10 space-y-2">
                            <span className="text-xs font-bold text-muted-foreground tracking-wide uppercase">
                              {language === "ar" ? "الخيار الثاني: إدخال يدوي" : "Option 2: Manual Input"}
                            </span>
                            <Textarea
                              placeholder={language === "ar" ? "أدخل الأرقام هنا (رقم في كل سطر أو مفصولة بفاصلة)، مثال:\n96590000000\n96591111111" : "Type numbers with country code:\n96590000000\n96591111111"}
                              rows={2}
                              value={manualNumbers}
                              onChange={(e) => handleManualNumbersChange(e.target.value)}
                              className="bg-card font-mono text-xs resize-none"
                              dir="ltr"
                            />
                          </div>
                        </div>

                        {/* Merged Numbers Metrics Panel */}
                        <div className="p-4 rounded-xl border border-border/80 bg-muted/30 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-4 flex-wrap text-sm font-medium">
                              <div>
                                {language === "ar" ? "أرقام إكسيل:" : "Excel Numbers:"}{" "}
                                <span className="font-bold text-foreground">{numbers.length}</span>
                              </div>
                              <div className="w-1.5 h-1.5 rounded-full bg-border" />
                              <div>
                                {language === "ar" ? "أرقام يدوية صالحة:" : "Valid Manual:"}{" "}
                                <span className="font-bold text-foreground">{getParsedManualNumbers().length}</span>
                              </div>
                              <div className="w-1.5 h-1.5 rounded-full bg-border" />
                              <div className="text-primary">
                                {language === "ar" ? "الإجمالي الفريد:" : "Total Unique:"}{" "}
                                <span className="font-extrabold">{finalNumbersList.length}</span>
                              </div>
                            </div>

                            <div className="flex gap-2">
                              {(numbers.length > 0 || manualNumbers.trim()) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs h-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => {
                                    setNumbers([]);
                                    setManualNumbers("");
                                    setFilteredNumbers([]);
                                  }}
                                >
                                  {language === "ar" ? "تفريغ الأرقام" : "Clear All"}
                                </Button>
                              )}

                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={handleFilterNumbers}
                                disabled={finalNumbersList.length === 0 || checkingNumbers}
                                className="text-xs h-8 border-primary/30 text-primary hover:bg-primary/5"
                              >
                                {checkingNumbers ? <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" /> : <Filter className="me-1.5 h-3.5 w-3.5" />}
                                {language === "ar" ? "تصفية الأرقام" : "Filter List"}
                              </Button>
                            </div>
                          </div>

                          {/* Filters display */}
                          {filteredNumbers.length > 0 && (
                            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex justify-between items-center">
                              <span>
                                {language === "ar" 
                                  ? `🔍 تمت التصفية: ${filteredNumbers.length} رقم نشط بالواتساب جاهز للإرسال.`
                                  : `🔍 Checked: ${filteredNumbers.length} active numbers ready.`}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-auto p-0 hover:bg-transparent text-emerald-600 dark:text-emerald-400 underline"
                                onClick={() => setFilteredNumbers([])}
                              >
                                {language === "ar" ? "إلغاء التصفية" : "Reset Filter"}
                              </Button>
                            </div>
                          )}

                          {/* 150 Limit alert warning */}
                          {(filteredNumbers.length > 150 || (filteredNumbers.length === 0 && finalNumbersList.length > 150)) && (
                            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
                              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                              <div className="text-xs font-semibold leading-relaxed">
                                {language === "ar"
                                  ? `⚠️ تجاوزت الأرقام المضافة الحد الأقصى (150 رقمًا). سيتم الإرسال لـ أول 150 رقمًا فقط لتجنب الحظر.`
                                  : `⚠️ Recipients exceed the 150 hard limit. We will slice and send to the first 150 numbers only.`}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Multiple Message Templates (Rotated) */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-border/50 pb-2">
                          <label className="text-sm font-semibold text-foreground/80">
                            {language === "ar" ? "نصوص الرسائل للتدوير" : "Rotating Message Texts"}
                          </label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 border-primary/20 text-primary hover:bg-primary/5 text-xs font-bold"
                            onClick={() => {
                              setMessageTemplates([...messageTemplates, ""]);
                              setActiveTextareaIdx(messageTemplates.length);
                            }}
                          >
                            <Plus className="me-1 h-3.5 w-3.5" />
                            {language === "ar" ? "إضافة نص بديل" : "Add Alternative"}
                          </Button>
                        </div>

                        {/* Formatting Toolbar */}
                        <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-lg border border-border bg-muted/20">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              title={language === "ar" ? "عريض" : "Bold"}
                              onClick={() => insertFormatting("*نص عريض*")}
                            >
                              <Bold className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              title={language === "ar" ? "مائل" : "Italic"}
                              onClick={() => insertFormatting("_نص مائل_")}
                            >
                              <Italic className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground text-xs font-semibold"
                              title={language === "ar" ? "يتوسطه خط" : "Strikethrough"}
                              onClick={() => insertFormatting("~نص مشطوب~")}
                            >
                              <s>S</s>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              title={language === "ar" ? "أحادي المسافة" : "Monospace"}
                              onClick={() => insertFormatting("`نص برمجى`")}
                            >
                              <Code className="h-4 w-4" />
                            </Button>
                          </div>

                          {/* Quick Emoji selection */}
                          <div className="flex items-center gap-1 overflow-x-auto max-w-[200px] sm:max-w-xs md:max-w-md py-1 scrollbar-none">
                            {travelEmojis.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                className="h-7 w-7 flex items-center justify-center text-base hover:bg-muted/80 rounded transition-colors shrink-0"
                                onClick={() => insertFormatting(emoji)}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* List of active message templates */}
                        <div className="space-y-4">
                          {messageTemplates.map((template, idx) => (
                            <div key={idx} className="relative p-4 rounded-xl border border-border bg-card shadow-sm space-y-2 group">
                              <div className="flex items-center justify-between">
                                <Badge variant="secondary" className="text-xs font-semibold px-2 py-0.5">
                                  {language === "ar" ? `نص الرسالة البديل #${idx + 1}` : `Alternative Message Text #${idx + 1}`}
                                </Badge>
                                {messageTemplates.length > 1 && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive absolute top-3 end-3"
                                    onClick={() => {
                                      const updated = messageTemplates.filter((_, i) => i !== idx);
                                      setMessageTemplates(updated);
                                      if (previewVariantIdx >= updated.length) {
                                        setPreviewVariantIdx(Math.max(0, updated.length - 1));
                                      }
                                      setActiveTextareaIdx(Math.max(0, idx - 1));
                                    }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                              <Textarea
                                placeholder={language === "ar" ? "اكتب نص الرسالة التسويقية هنا..." : "Write campaign message content here..."}
                                rows={4}
                                value={template}
                                onFocus={() => setActiveTextareaIdx(idx)}
                                onChange={(e) => {
                                  const updated = [...messageTemplates];
                                  updated[idx] = e.target.value;
                                  setMessageTemplates(updated);
                                }}
                                className="w-full resize-y font-normal mt-1 border-border/80"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Limit and Timing Configuration */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-border/50 pt-4">
                        {/* 1. Sending cap limit */}
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-foreground/80">
                            {language === "ar" ? "الحد الأقصى للإرسال (1-150)" : "Max Send Limit (1-150)"}
                          </label>
                          <Input 
                            type="number"
                            min={1}
                            max={150}
                            value={maxMessages}
                            onChange={(e) => setMaxMessages(Math.min(150, Math.max(1, parseInt(e.target.value) || 150)))}
                            className="font-medium"
                          />
                        </div>

                        {/* 2. Timing Gap (s) */}
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-foreground/80 flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {language === "ar" ? "الفارق الزمني (ثواني)" : "Time Gap (Seconds)"}
                          </label>
                          <div className="flex items-center gap-2">
                            <Input 
                              type="number" 
                              placeholder="Min" 
                              value={timeGapMin} 
                              onChange={(e) => setTimeGapMin(Math.max(1, parseInt(e.target.value) || 5))} 
                            />
                            <span className="text-xs font-bold text-muted-foreground">{language === "ar" ? "إلى" : "to"}</span>
                            <Input 
                              type="number" 
                              placeholder="Max" 
                              value={timeGapMax} 
                              onChange={(e) => setTimeGapMax(Math.max(timeGapMin, parseInt(e.target.value) || 10))} 
                            />
                          </div>
                        </div>

                        {/* 3. Batch Size */}
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-foreground/80 flex items-center gap-1">
                            <Layers className="h-3.5 w-3.5" />
                            {language === "ar" ? "حجم الدفعة" : "Batch Size"}
                          </label>
                          <Input 
                            type="number" 
                            value={batchSize} 
                            onChange={(e) => setBatchSize(Math.max(1, parseInt(e.target.value) || 10))} 
                          />
                        </div>
                      </div>

                      {/* Scheduled At Time (Optional) */}
                      <div className="space-y-2 border-t border-border/50 pt-4">
                        <label className="text-sm font-semibold text-foreground/80 flex items-center gap-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          {language === "ar" ? "جدولة وقت البدء (اختياري)" : "Schedule Launch Time (Optional)"}
                        </label>
                        <Input 
                          type="datetime-local" 
                          value={scheduledAt}
                          onChange={(e) => setScheduledAt(e.target.value)}
                          className="w-full sm:max-w-xs"
                        />
                      </div>

                      {/* Submit campaign */}
                      <Button 
                        className="w-full bg-primary hover:bg-primary/95 text-primary-foreground font-bold py-6 text-base rounded-xl transition-all shadow-md"
                        onClick={() => createCampaignMutation.mutate()}
                        disabled={
                          createCampaignMutation.isPending || 
                          finalNumbersList.length === 0 || 
                          messageTemplates.some(t => !t.trim()) || 
                          !campaignName
                        }
                      >
                        {createCampaignMutation.isPending ? <Loader2 className="me-2 h-5 w-5 animate-spin" /> : <Play className="me-2 h-5 w-5" />}
                        {language === "ar" ? "بدء إرسال الحملة" : "Launch Marketing Campaign"}
                      </Button>

                    </CardContent>
                  </Card>
                </div>

                {/* WhatsApp Chat Preview & Instructions Panel */}
                <div className="xl:col-span-2 space-y-6">
                  
                  {/* WhatsApp Device Mock Preview */}
                  <Card className="bg-slate-950 border-slate-800 shadow-2xl overflow-hidden text-start rounded-3xl relative p-3">
                    {/* Speaker notch */}
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-4 rounded-full bg-slate-900 border border-slate-800 flex justify-center items-center gap-1 z-10">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                      <div className="w-8 h-1 rounded-full bg-slate-800" />
                    </div>

                    <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 min-h-[440px] flex flex-col relative pt-4">
                      
                      {/* WhatsApp Chat Header */}
                      <div className="bg-[#0b141a] px-3 py-3 border-b border-slate-800 flex items-center justify-between text-white">
                        <div className="flex items-center gap-2">
                          <Smartphone className="h-4 w-4 text-emerald-500" />
                          <div className="text-start">
                            <div className="text-xs font-bold text-slate-100 flex items-center gap-1">
                              {language === "ar" ? "معاينة الواتساب" : "WhatsApp Preview"}
                              <Badge className="bg-emerald-600/35 hover:bg-emerald-600/35 text-[9px] text-emerald-400 py-0 px-1 border border-emerald-500/20">Biz</Badge>
                            </div>
                            <p className="text-[10px] text-slate-400">Online</p>
                          </div>
                        </div>

                        {/* Preview selector if multiple templates exist */}
                        {messageTemplates.length > 1 && (
                          <div className="flex items-center gap-1.5 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                            <button
                              type="button"
                              onClick={() => setPreviewVariantIdx(prev => Math.max(0, prev - 1))}
                              disabled={previewVariantIdx === 0}
                              className="text-slate-300 disabled:opacity-40 disabled:pointer-events-none hover:text-white"
                            >
                              <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                            <span className="text-[9px] font-mono font-bold tabular-nums">
                              {previewVariantIdx + 1} / {messageTemplates.length}
                            </span>
                            <button
                              type="button"
                              onClick={() => setPreviewVariantIdx(prev => Math.min(messageTemplates.length - 1, prev + 1))}
                              disabled={previewVariantIdx === messageTemplates.length - 1}
                              className="text-slate-300 disabled:opacity-40 disabled:pointer-events-none hover:text-white"
                            >
                              <ChevronLeft className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Message Chat Body */}
                      <div className="flex-1 bg-[#0b141a] p-4 flex flex-col justify-end space-y-4 overflow-y-auto" style={{ backgroundImage: "radial-gradient(#111b21 0.75px, transparent 0.75px)", backgroundSize: "16px 16px" }}>
                        
                        {/* Interactive Message Bubble */}
                        <div className="max-w-[85%] self-end bg-[#005c4b] text-[#e9edef] rounded-lg p-3 text-xs leading-relaxed relative shadow shadow-black/40">
                          {/* Triangle tail */}
                          <div className="absolute top-0 -end-1.5 w-0 h-0 border-t-[8px] border-t-[#005c4b] border-e-[8px] border-e-transparent" />
                          
                          <div 
                            className="whitespace-pre-wrap break-words"
                            dangerouslySetInnerHTML={{ 
                              __html: formatWhatsAppText(messageTemplates[previewVariantIdx] || messageTemplates[0] || (language === "ar" ? "*معاينة الرسالة تظهر هنا...*" : "*Message preview here...*")) 
                            }}
                          />
                          
                          <div className="flex justify-end items-center gap-1 mt-1.5 text-[9px] text-[#8696a0] font-mono">
                            <span>12:00 PM</span>
                            <span className="text-emerald-400">✓✓</span>
                          </div>
                        </div>

                      </div>

                    </div>
                  </Card>

                  {/* Campaign Guidelines Notes */}
                  <Card className="bg-card border-border shadow-sm text-start">
                    <CardHeader className="pb-3 border-b border-border/50">
                      <CardTitle className="flex items-center gap-1.5 text-base font-semibold text-foreground/80">
                        <FileText className="h-4.5 w-4.5 text-primary" />
                        {language === "ar" ? "إرشادات تفادي الحظر والتسويق" : "Campaign Guidelines & Safety"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-2.5 text-xs text-muted-foreground leading-relaxed">
                      <p className="flex items-start gap-1.5">
                        <span className="text-primary font-bold">•</span>
                        <span>{language === "ar" ? "يجب وضع الأرقام في العمود الأول لملف الإكسيل." : "Excel numbers must be stored in the first column."}</span>
                      </p>
                      <p className="flex items-start gap-1.5">
                        <span className="text-primary font-bold">•</span>
                        <span>{language === "ar" ? "يتم توزيع صِيغ الرسائل التي أضفتها بالتناوب التلقائي (Round-Robin) على المستلمين لضمان تنوع النصوص وحماية رقمك من فلاتر السبام بالواتساب." : "Message templates will be sent sequentially (round-robin) to reduce repetitive delivery triggers and protect your account."}</span>
                      </p>
                      <p className="flex items-start gap-1.5">
                        <span className="text-primary font-bold">•</span>
                        <span>{language === "ar" ? "تأكد من ضبط فوارق زمنية كافية (مثل 5 إلى 15 ثانية) وحجم دفعة مناسب." : "Keep timing gaps large (e.g. 5-15s) and batch sizes reasonable to match human activity."}</span>
                      </p>
                      <p className="flex items-start gap-1.5">
                        <span className="text-primary font-bold">•</span>
                        <span>{language === "ar" ? "يقوم النظام تلقائيًا بإضافة لاحقة إلغاء الاشتراك للرسائل غير المحتوية عليها تجنباً للتبليغات." : "An opt-out suffix is automatically appended to protect your sender repute from abuse reports."}</span>
                      </p>
                    </CardContent>
                  </Card>

                </div>

              </div>
            </div>
          )}

          {/* ── Reports Tab ──────────────────────────────────────────────────── */}
          {currentTab === "reports" && (
            <Card className="bg-card border-border shadow-sm text-start">
              <CardHeader className="border-b border-border/50 pb-4">
                <CardTitle className="flex items-center gap-2 text-xl font-bold">
                  <FileText className="h-5 w-5 text-primary" />
                  {language === "ar" ? "تقارير الحملات المرسلة" : "Campaign Reports"}
                </CardTitle>
                <CardDescription>
                  {language === "ar" ? "متابعة حالة الإرسال والتقارير للحملات الجارية والسابقة." : "Monitor sending status and reports for current and past campaigns."}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                {campaignsLoading ? (
                  <div className="flex justify-center p-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <Table className="min-w-[700px]">
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead className="font-bold">{language === "ar" ? "اسم الحملة" : "Campaign Name"}</TableHead>
                          <TableHead className="font-bold">{t("common.status")}</TableHead>
                          <TableHead className="font-bold">{language === "ar" ? "الإجمالي" : "Total"}</TableHead>
                          <TableHead className="font-bold">{language === "ar" ? "تم الإرسال" : "Sent"}</TableHead>
                          <TableHead className="font-bold">{language === "ar" ? "تم التسليم" : "Delivered"}</TableHead>
                          <TableHead className="font-bold">{language === "ar" ? "تمت القراءة" : "Read"}</TableHead>
                          <TableHead className="font-bold">{language === "ar" ? "فشل" : "Failed"}</TableHead>
                          <TableHead className="text-end font-bold">{t("common.actions")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {campaignsData?.campaigns.map((camp: any) => (
                          <TableRow key={camp.id} className="hover:bg-muted/10">
                            <TableCell className="font-semibold">{camp.name}</TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                                camp.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                                camp.status === 'running' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' :
                                'bg-amber-500/10 text-amber-600 border-amber-500/20'
                              }`}>
                                {camp.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5" />}
                                {camp.status === 'running' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                {camp.status === 'paused' && <Pause className="w-3.5 h-3.5" />}
                                {camp.status === 'completed' ? (language === "ar" ? "مكتملة" : "Completed") :
                                 camp.status === 'running' ? (language === "ar" ? "جارية" : "Running") : (language === "ar" ? "متوقفة مؤقتاً" : "Paused")}
                              </span>
                            </TableCell>
                            <TableCell className="font-mono text-sm">{camp.total}</TableCell>
                            <TableCell className="font-bold font-mono text-sm text-foreground/80">{camp.sent}</TableCell>
                            <TableCell className="text-blue-500 font-bold font-mono text-sm">{camp.delivered || 0}</TableCell>
                            <TableCell className="text-emerald-600 dark:text-emerald-400 font-bold font-mono text-sm">{camp.read || 0}</TableCell>
                            <TableCell className="text-destructive font-bold font-mono text-sm">{camp.failed}</TableCell>
                            <TableCell className="text-end">
                              <div className="flex justify-end items-center gap-2">
                                {camp.status === 'paused' && (
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 border-emerald-500/20 h-8"
                                    onClick={() => resumeCampaignMutation.mutate(camp.id)}
                                    disabled={resumeCampaignMutation.isPending}
                                  >
                                    <Play className="me-1 h-3.5 w-3.5" /> {language === "ar" ? "استئناف" : "Resume"}
                                  </Button>
                                )}
                                {camp.status === 'running' && (
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 border-amber-500/20 h-8"
                                    onClick={() => pauseCampaignMutation.mutate(camp.id)}
                                    disabled={pauseCampaignMutation.isPending}
                                  >
                                    <Pause className="me-1 h-3.5 w-3.5" /> {language === "ar" ? "إيقاف مؤقت" : "Pause"}
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {campaignsData?.campaigns.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
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
          )}

          {/* ── Routing Tab ───────────────────────────────────────────────────── */}
          {currentTab === "routing" && (
            <div className="animate-in fade-in duration-300">
              <WhatsappRoutingTab />
            </div>
          )}

          {/* ── Groups Tab ───────────────────────────────────────────────────── */}
          {currentTab === "groups" && (
            <Card className="bg-card border-border shadow-sm text-start">
              <CardHeader className="border-b border-border/50 pb-4">
                <CardTitle className="flex items-center gap-2 text-xl font-bold">
                  <Users className="h-5 w-5 text-primary" />
                  {language === "ar" ? "إدارة مجموعات الواتساب المشترك بها" : "Group Management"}
                </CardTitle>
                <CardDescription>
                  {language === "ar" ? "عرض المجموعات التي يشترك بها رقم الواتساب المربوط وسحب أعضائها." : "View groups the account is subscribed to."}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                {groupsLoading ? (
                  <div className="flex justify-center p-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <Table className="min-w-[500px]">
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead className="font-bold">{language === "ar" ? "اسم المجموعة" : "Group Name"}</TableHead>
                          <TableHead className="font-bold">{language === "ar" ? "معرف المجموعة (JID)" : "Identifier (JID)"}</TableHead>
                          <TableHead className="text-end font-bold">{t("common.actions")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groupsData?.groups?.map((group: any) => (
                          <TableRow key={group.id} className="hover:bg-muted/10">
                            <TableCell className="font-semibold">{group.subject}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">{group.id}</TableCell>
                            <TableCell className="text-end">
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="h-8 border-primary/20 text-primary hover:bg-primary/5"
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
                                <Upload className="h-4 w-4 me-1" /> {language === "ar" ? "تصدير الأعضاء إكسيل" : "Export Members"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {(!groupsData?.groups || groupsData.groups.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
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
          )}

          {/* ── Contacts Extract Tab ─────────────────────────────────────────── */}
          {currentTab === "contacts" && (
            <Card className="bg-card border-border shadow-sm text-start">
              <CardHeader className="border-b border-border/50 pb-4">
                <CardTitle className="flex items-center gap-2 text-xl font-bold">
                  <Users className="h-5 w-5 text-primary" />
                  {language === "ar" ? "جميع جهات اتصال الواتساب" : "All WhatsApp Contacts"}
                </CardTitle>
                <CardDescription>
                  {language === "ar" ? "عرض جميع الدردشات وجهات الاتصال المسحوبة من حساب الواتساب الخاص بك." : "View all chats and contacts from your WhatsApp account."}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {contactsLoading ? (
                  <div className="flex justify-center p-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap justify-between items-center bg-muted/30 p-4 rounded-xl border border-border/50 gap-4">
                      <div>
                        <h3 className="font-bold text-foreground text-sm">{language === "ar" ? `إجمالي جهات الاتصال المسحوبة: ${contactsData?.total || 0}` : `Total Extracted: ${contactsData?.total || 0}`}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{language === "ar" ? "جهات الاتصال الفريدة التي تم استخراجها من الدردشات وقائمة الأسماء." : "Unique contacts found in your chats and contacts list."}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="secondary"
                          onClick={() => refetchContacts()}
                          className="h-9 text-xs font-semibold"
                        >
                          {language === "ar" ? "تحديث السحب" : "Refresh Extract"}
                        </Button>
                        <Button 
                          variant="outline"
                          className="h-9 text-xs font-semibold border-primary/20 text-primary hover:bg-primary/5"
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
                          <Upload className="h-4 w-4 me-2" /> {language === "ar" ? "تصدير إلى إكسيل" : "Export to Excel"}
                        </Button>
                      </div>
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <Table className="min-w-[700px]">
                        <TableHeader className="bg-muted/30">
                          <TableRow>
                            <TableHead className="font-bold">{t("common.name")}</TableHead>
                            <TableHead className="font-bold">{t("common.phone")}</TableHead>
                            <TableHead className="font-bold">{language === "ar" ? "المصدر" : "Source"}</TableHead>
                            <TableHead className="font-bold">{t("common.status")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {contactsData?.contacts?.map((contact: any, i: number) => (
                            <TableRow key={i} className="hover:bg-muted/10">
                              <TableCell className="font-semibold">{contact.name || "-"}</TableCell>
                              <TableCell className="font-mono text-sm">{contact.phone}</TableCell>
                              <TableCell className="capitalize text-xs text-muted-foreground">{contact.source}</TableCell>
                              <TableCell>
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
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
          )}

          {/* ── Settings Tab ─────────────────────────────────────────────────── */}
          {currentTab === "settings" && (
            <div className="animate-in fade-in duration-300">
              <WhatsappSettings />
            </div>
          )}

          {/* ── Quick Replies Tab ───────────────────────────────────────────── */}
          {currentTab === "quick-replies" && (
            <div className="animate-in fade-in duration-300">
              <WhatsappQuickRepliesTab />
            </div>
          )}

          {/* ── Automations Tab ─────────────────────────────────────────────── */}
          {currentTab === "automations" && (
            <div className="animate-in fade-in duration-300">
              <WhatsappAutomationsTab />
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
