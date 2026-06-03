import { ShieldOff } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

const BRAND_GRADIENT = "linear-gradient(135deg, #1e40af 0%, #3b82f6 75%, #10b981 100%)";
const SIDEBAR_GRADIENT = "linear-gradient(180deg, #070f2e 0%, #0f172a 50%, #1e293b 100%)";

export default function NotAuthorized() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center" style={{ background: SIDEBAR_GRADIENT }}>
      <div className="w-full max-w-sm mx-4">
        <div className="rounded-2xl p-8 shadow-2xl" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <div className="flex mb-4 gap-3 items-center">
            <ShieldOff className="h-8 w-8 text-yellow-400 shrink-0" />
            <h1 className="text-2xl font-bold text-white">Not Authorized</h1>
          </div>
          <p className="mt-2 text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
            You don't have permission to view this page. This area is restricted to administrators only.
          </p>
          <Link to="/">
            <Button
              className="mt-6 w-full font-semibold h-11 border-0 hover:opacity-90"
              style={{ background: BRAND_GRADIENT, color: "#ffffff" }}
            >
              Go to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
