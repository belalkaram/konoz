import { useState, useEffect } from "react";
import { Plane, Lock, User } from "lucide-react";
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

  return (
    <div className="min-h-screen flex items-center justify-center relative" style={{ background: SIDEBAR_GRADIENT }}>
      {/* Floating Language Switcher */}
      <div className="absolute top-4 end-4">
        <button
          onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
          className="px-3 py-1.5 rounded-full border border-white/10 transition-all text-xs font-bold flex items-center justify-center bg-white/5 hover:bg-white/10 text-white gap-1"
        >
          <span>🌐</span>
          <span>{language === "ar" ? "English" : "العربية"}</span>
        </button>
      </div>

      <div className="w-full max-w-sm mx-4">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: BRAND_GRADIENT }}>
            <Plane className={cn("h-7 w-7", isRtl ? "-rotate-45" : "rotate-45")} style={{ color: "#ffffff" }} />
          </div>
          <h1 className="text-white font-bold text-2xl tracking-wide animate-in fade-in duration-300"
            style={isRtl ? undefined : { fontFamily: "'Playfair Display', 'Georgia', serif" }}>
            {t("common.aeroOps")}
          </h1>
          <p className="text-sm mt-1 tracking-widest uppercase font-medium" style={{ color: "#86efac" }}>
            {t("common.premium")}
          </p>
        </div>

        <div className="rounded-2xl p-8 shadow-2xl" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <h2 className="text-white text-xl font-semibold mb-1">{t("login.title")}</h2>
          <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.5)" }}>{t("login.subtitle")}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.7)" }}>
                {t("login.username")}
              </Label>
              <div className="relative">
                <User className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "rgba(255,255,255,0.4)" }} />
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={language === "ar" ? "مثال: belal" : "e.g. Belal"}
                  autoComplete="username"
                  autoFocus
                  className="ps-9 pe-3 border-0 text-white placeholder:text-white/30"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.7)" }}>
                {t("login.pin")}
              </Label>
              <div className="relative">
                <Lock className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "rgba(255,255,255,0.4)" }} />
                <Input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder={language === "ar" ? "أدخل الرمز السري" : "Enter your PIN"}
                  autoComplete="current-password"
                  className="ps-9 pe-3 border-0 text-white placeholder:text-white/30"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                  disabled={loading}
                  maxLength={8}
                />
              </div>
            </div>

            {error && (
              <p className="text-sm rounded-lg px-3 py-2 animate-in slide-in-from-top-2 duration-200" style={{ background: "rgba(239,68,68,0.15)", color: "#fca5a5" }}>
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full font-semibold h-11 border-0 hover:opacity-90 transition-all duration-300"
              style={{ background: BRAND_GRADIENT, color: "#ffffff" }}
            >
              {loading ? t("login.signingIn") : t("login.btnText")}
            </Button>
          </form>

          <p className="text-xs text-center mt-6" style={{ color: "rgba(255,255,255,0.3)" }}>
            {language === "ar" ? "تواصل مع المسؤول إذا كنت بحاجة إلى صلاحيات وصول" : "Contact your administrator if you need access"}
          </p>
        </div>
      </div>
    </div>
  );
}
