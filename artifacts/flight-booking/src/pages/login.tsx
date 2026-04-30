import { useState, useEffect } from "react";
import { Plane, Lock, User } from "lucide-react";
import { useEmployee } from "@/contexts/employee-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const GOLD_GRADIENT = "linear-gradient(135deg, #d4af37 0%, #f5d76e 50%, #d4af37 100%)";
const SIDEBAR_GRADIENT = "linear-gradient(180deg, #011a13 0%, #022c22 40%, #064e3b 100%)";

export default function Login() {
  const { login } = useEmployee();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "deactivated") {
      setError("Your account has been deactivated. Please contact your supervisor to reactivate your account.");
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !pin.trim()) {
      setError("Please enter your username and PIN.");
      return;
    }

    setLoading(true);
    setError("");
    const result = await login(username.trim(), pin.trim());
    setLoading(false);

    if (!result.success) {
      setError(result.error ?? "Invalid credentials");
      setPin("");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: SIDEBAR_GRADIENT }}>
      <div className="w-full max-w-sm mx-4">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: GOLD_GRADIENT }}>
            <Plane className="h-7 w-7 rotate-45" style={{ color: "#022c22" }} />
          </div>
          <h1 className="text-white font-bold text-2xl tracking-wide"
            style={{ fontFamily: "'Playfair Display', 'Georgia', serif" }}>
            AeroOps
          </h1>
          <p className="text-sm mt-1 tracking-widest uppercase font-medium" style={{ color: "#86efac" }}>
            Premium
          </p>
        </div>

        <div className="rounded-2xl p-8 shadow-2xl" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <h2 className="text-white text-xl font-semibold mb-1">Welcome back</h2>
          <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.5)" }}>Sign in to your account</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.7)" }}>
                Username
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "rgba(255,255,255,0.4)" }} />
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. Belal"
                  autoComplete="username"
                  autoFocus
                  className="pl-9 border-0 text-white placeholder:text-white/30"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.7)" }}>
                PIN
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "rgba(255,255,255,0.4)" }} />
                <Input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Enter your PIN"
                  autoComplete="current-password"
                  className="pl-9 border-0 text-white placeholder:text-white/30"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                  disabled={loading}
                  maxLength={8}
                />
              </div>
            </div>

            {error && (
              <p className="text-sm rounded-lg px-3 py-2" style={{ background: "rgba(239,68,68,0.15)", color: "#fca5a5" }}>
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full font-semibold h-11 border-0 hover:opacity-90"
              style={{ background: GOLD_GRADIENT, color: "#022c22" }}
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <p className="text-xs text-center mt-6" style={{ color: "rgba(255,255,255,0.3)" }}>
            Contact your administrator if you need access
          </p>
        </div>
      </div>
    </div>
  );
}
