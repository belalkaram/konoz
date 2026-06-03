import { AlertCircle } from "lucide-react";

const SIDEBAR_GRADIENT = "linear-gradient(180deg, #070f2e 0%, #0f172a 50%, #1e293b 100%)";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center" style={{ background: SIDEBAR_GRADIENT }}>
      <div className="w-full max-w-sm mx-4">
        <div className="rounded-2xl p-8 shadow-2xl" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <div className="flex mb-4 gap-3 items-center">
            <AlertCircle className="h-8 w-8 text-red-400 shrink-0" />
            <h1 className="text-2xl font-bold text-white">404 Page Not Found</h1>
          </div>
          <p className="mt-4 text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
            Did you forget to add the page to the router?
          </p>
        </div>
      </div>
    </div>
  );
}
