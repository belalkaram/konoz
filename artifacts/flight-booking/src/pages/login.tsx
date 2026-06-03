import { useState, useEffect } from "react";
import { 
  Plane, Lock, User, Users, Tag, ShieldCheck, 
  CreditCard, BarChart3, MessageSquare, Globe 
} from "lucide-react";
import { useEmployee } from "@/contexts/employee-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/language-context";
import { cn } from "@/lib/utils";

const BRAND_GRADIENT = "linear-gradient(135deg, #1e40af 0%, #3b82f6 75%, #10b981 100%)";
const SIDEBAR_GRADIENT = "linear-gradient(180deg, #070f2e 0%, #0f172a 50%, #1e293b 100%)";

export default function Login() {
  const { login } = useEmployee();
  const { language, setLanguage, t, isRtl } = useLanguage();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "deactivated") {
      setError(
        language === "ar"
          ? "تم إلغاء تفعيل حسابك. يرجى التواصل مع المسؤول لإعادة تفعيله."
          : "Your account has been deactivated. Please contact your supervisor to reactivate your account."
      );
    }
  }, [language]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !pin.trim()) {
      setError(
        language === "ar"
          ? "يرجى إدخال اسم المستخدم والرمز السري."
          : "Please enter your username and PIN."
      );
      return;
    }

    setLoading(true);
    setError("");
    const result = await login(username.trim(), pin.trim());
    setLoading(false);

    if (!result.success) {
      setError(result.error ? (language === "ar" ? t("login.invalidUser") : result.error) : t("login.invalidUser"));
      setPin("");
    }
  };

  const features = [
    {
      icon: Users,
      titleAr: "إدارة العملاء",
      titleEn: "Customer Management",
      descAr: "تنظيم بيانات العملاء ومتابعة التفاعلات والتذكيرات بدقة.",
      descEn: "Organize client data, follow-ups, and reminders accurately.",
    },
    {
      icon: Tag,
      titleAr: "التذاكر والحجوزات",
      titleEn: "Tickets & Bookings",
      descAr: "متابعة وإصدار تذاكر الطيران وحالات الدفع الخاصة بها.",
      descEn: "Track and issue flight tickets and their payment status.",
    },
    {
      icon: ShieldCheck,
      titleAr: "إدارة الموظفين",
      titleEn: "Employees Management",
      descAr: "تنظيم أدوار الموظفين ومتابعة وتتبع كفاءة الأداء.",
      descEn: "Structure employee roles and track performance KPIs.",
    },
    {
      icon: CreditCard,
      titleAr: "الحسابات والمالية",
      titleEn: "Accounting & Finance",
      descAr: "مراقبة الإيرادات والمصروفات والرواتب وإعداد الفواتير.",
      descEn: "Monitor revenues, expenses, payrolls, and invoice reports.",
    },
    {
      icon: BarChart3,
      titleAr: "مركز الأداء والتقارير",
      titleEn: "Performance & Reports",
      descAr: "إحصائيات ذكية ورسوم بيانية تفصيلية لدعم اتخاذ القرار.",
      descEn: "Smart stats and comprehensive charts to aid decision-making.",
    },
    {
      icon: MessageSquare,
      titleAr: "إشعارات الواتساب",
      titleEn: "WhatsApp Integration",
      descAr: "إرسال تنبيهات تلقائية للعملاء وتنبيهات الأداء المالي.",
      descEn: "Send automated alerts to clients and financial target updates.",
    },
  ];

  return (
    <div 
      className="min-h-screen w-full flex flex-col lg:flex-row overflow-y-auto" 
      style={{ background: SIDEBAR_GRADIENT }}
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Visual Showcase Panel */}
      <div className="w-full lg:w-1/2 flex flex-col justify-between p-8 lg:p-12 relative overflow-hidden border-b lg:border-b-0 lg:border-e border-white/5">
        {/* Decorative background blobs */}
        <div className="absolute top-[-10%] start-[-10%] w-[50%] h-[50%] rounded-full filter blur-3xl opacity-20 animate-pulse bg-blue-500" />
        <div className="absolute bottom-[-10%] end-[-10%] w-[50%] h-[50%] rounded-full filter blur-3xl opacity-20 animate-pulse bg-emerald-500" />

        {/* System Title / Branding */}
        <div className="flex items-center gap-3 relative z-10">
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
            style={{ background: BRAND_GRADIENT }}
          >
            <Plane className={cn("h-5 w-5 text-white", isRtl ? "-rotate-45" : "rotate-45")} />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg leading-tight">
              {language === "ar" ? "نظام كنوز CRM" : "Konoz CRM System"}
            </h1>
            <p className="text-[10px] text-emerald-400 font-semibold tracking-wider uppercase">
              {language === "ar" ? "إدارة ذكية وآمنة" : "SMART & SECURE MANAGEMENT"}
            </p>
          </div>
        </div>

        {/* System Value Prop & Features List */}
        <div className="my-10 lg:my-0 relative z-10 max-w-xl">
          <h2 className="text-white text-2xl lg:text-3xl font-extrabold mb-4 leading-tight">
            {language === "ar" 
              ? "منصة متكاملة لإدارة أعمالك وحجوزاتك بكل سهولة" 
              : "Unified Platform to Manage Your Travel Agency & CRM"}
          </h2>
          <p className="text-white/60 text-sm mb-8">
            {language === "ar"
              ? "نظام متكامل صمم خصيصاً لمساعدتك في أتمتة العمليات اليومية ومتابعة الموظفين والعملاء وزيادة الأرباح بنقرة واحدة."
              : "An all-in-one system custom built to help you automate daily tasks, track employee performance, manage clients, and maximize profits."}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {features.map((feat, index) => {
              const IconComp = feat.icon;
              return (
                <div 
                  key={index} 
                  className="p-4 rounded-xl border border-white/5 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/10 transition-all duration-300 group"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:bg-blue-500/20 group-hover:text-white transition-colors">
                      <IconComp className="h-4 w-4" />
                    </div>
                    <h3 className="text-white font-bold text-sm">
                      {language === "ar" ? feat.titleAr : feat.titleEn}
                    </h3>
                  </div>
                  <p className="text-white/55 text-xs leading-relaxed">
                    {language === "ar" ? feat.descAr : feat.descEn}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Credit */}
        <div className="text-white/30 text-[10px] relative z-10 pt-4 border-t border-white/5">
          &copy; {new Date().getFullYear()} {language === "ar" ? "نظام كنوز CRM. جميع الحقوق محفوظة." : "Konoz CRM System. All rights reserved."}
        </div>
      </div>

      {/* Login Form Panel */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 lg:p-12 relative">
        {/* Floating Language Switcher */}
        <div className="absolute top-6 end-6 z-20">
          <button
            onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
            className="px-3.5 py-1.5 rounded-full border border-white/10 transition-all text-xs font-semibold flex items-center justify-center bg-white/5 hover:bg-white/10 text-white gap-1.5 cursor-pointer"
          >
            <Globe className="h-3.5 w-3.5" />
            <span>{language === "ar" ? "English" : "العربية"}</span>
          </button>
        </div>

        <div className="w-full max-w-md">
          {/* Logo on mobile view (hidden on desktop) */}
          <div className="flex flex-col items-center mb-8 lg:hidden">
            <div 
              className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg mb-3"
              style={{ background: BRAND_GRADIENT }}
            >
              <Plane className={cn("h-6 w-6 text-white", isRtl ? "-rotate-45" : "rotate-45")} />
            </div>
            <h1 className="text-white font-bold text-xl leading-tight text-center">
              {language === "ar" ? "نظام كنوز CRM" : "Konoz CRM System"}
            </h1>
          </div>

          {/* Form container */}
          <div className="rounded-2xl p-6 lg:p-8 shadow-2xl bg-white/[0.04] border border-white/10">
            <h2 className="text-white text-2xl font-bold mb-1.5">{t("login.title")}</h2>
            <p className="text-sm text-white/50 mb-6">{t("login.subtitle")}</p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-white/70">
                  {t("login.username")}
                </Label>
                <div className="relative">
                  <User className="absolute start-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-white/40" />
                  <Input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={language === "ar" ? "مثال: belal" : "e.g. Belal"}
                    autoComplete="username"
                    autoFocus
                    className="ps-10 pe-4 py-5 border-0 text-white placeholder:text-white/30 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.08)" }}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-white/70">
                  {t("login.pin")}
                </Label>
                <div className="relative">
                  <Lock className="absolute start-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-white/40" />
                  <Input
                    type="password"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder={language === "ar" ? "أدخل الرمز السري" : "Enter your PIN"}
                    autoComplete="current-password"
                    className="ps-10 pe-4 py-5 border-0 text-white placeholder:text-white/30 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.08)" }}
                    disabled={loading}
                    maxLength={8}
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm rounded-xl px-4 py-3 animate-in slide-in-from-top-2 duration-200 bg-red-500/15 text-red-300 border border-red-500/20">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full font-bold h-11 border-0 hover:opacity-90 transition-all duration-300 rounded-xl cursor-pointer shadow-lg"
                style={{ background: BRAND_GRADIENT, color: "#ffffff" }}
              >
                {loading ? t("login.signingIn") : t("login.btnText")}
              </Button>
            </form>

            <p className="text-xs text-center text-white/30 mt-6 leading-relaxed">
              {language === "ar" 
                ? "تواصل مع المسؤول إذا كنت بحاجة إلى صلاحيات وصول للنظام." 
                : "Contact your administrator if you need access privileges."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
