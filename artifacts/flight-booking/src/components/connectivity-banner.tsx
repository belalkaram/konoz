import { useState, useEffect } from "react";
import { WifiOff, Wifi, RefreshCw, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export function ConnectivityBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showReconnecting, setShowReconnecting] = useState(false);
  const [lastOnline, setLastOnline] = useState(Date.now());

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnecting(true);
      setLastOnline(Date.now());
      setTimeout(() => setShowReconnecting(false), 3000);
    };
    
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline && !showReconnecting) return null;

  return (
    <div
      className={cn(
        "z-[100] w-full py-2 px-4 flex items-center justify-center gap-3 text-sm font-medium transition-all duration-500 overflow-hidden animate-in slide-in-from-top",
        isOnline ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
      )}
    >
      {isOnline ? (
        <>
          <Wifi className="h-4 w-4 animate-bounce" />
          <span>Connection restored. Syncing data...</span>
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4" />
          <span className="flex items-center gap-2">
            Internet disconnected. Some features may be unavailable.
            <button 
              onClick={() => window.location.reload()}
              className="ml-2 px-2 py-0.5 rounded bg-white/20 hover:bg-white/30 transition-colors flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" /> Retry
            </button>
          </span>
        </>
      )}
    </div>
  );
}

export function ErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#f0fdf4]">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border-2 border-red-500/20 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="h-8 w-8 text-red-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h2>
        <p className="text-gray-600 mb-6 italic">
          "{error.message}"
        </p>
        <p className="text-sm text-gray-500 mb-8">
          This could be due to a poor internet connection or a temporary server issue.
        </p>
        <div className="space-y-3">
          <Button onClick={resetErrorBoundary} className="w-full bg-emerald-700 hover:bg-emerald-800 py-6 text-lg">
            <RefreshCw className="h-5 w-5 mr-2" /> Try Again
          </Button>
          <Button variant="ghost" onClick={() => window.location.href = "/"} className="w-full">
            Back to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}

import { Button } from "./ui/button";
