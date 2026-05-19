import { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertTriangle, RefreshCw, Globe, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
  isNetworkError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "", isNetworkError: false };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    const isNetworkError = message.toLowerCase().includes("network") || 
                          message.toLowerCase().includes("fetch") || 
                          message.toLowerCase().includes("internet");
    return { hasError: true, message, isNetworkError };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, message: "", isNetworkError: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#f0fdf4] dark:bg-background">
        <div className="max-w-md w-full bg-white dark:bg-card rounded-2xl shadow-2xl p-8 border border-emerald-100 dark:border-border text-center relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-amber-400 to-emerald-500" />
          
          <div className="flex justify-center mb-6">
            <div className={
              `w-20 h-20 rounded-full flex items-center justify-center ${this.state.isNetworkError ? 'bg-amber-50 dark:bg-amber-950/20' : 'bg-red-50 dark:bg-red-950/20'}`
            }>
              {this.state.isNetworkError ? (
                <Globe className="w-10 h-10 text-amber-600 dark:text-amber-400 animate-pulse" />
              ) : (
                <AlertTriangle className="w-10 h-10 text-red-600 dark:text-red-400" />
              )}
            </div>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-foreground mb-2">
            {this.state.isNetworkError ? "Connection Issue" : "Application Error"}
          </h1>
          
          <p className="text-gray-600 dark:text-muted-foreground mb-6 leading-relaxed">
            {this.state.isNetworkError 
              ? "We're having trouble connecting to the system. This is usually caused by an unstable internet connection."
              : "An unexpected error occurred while processing your request. Our system logs have been updated."}
          </p>

          <div className="rounded-xl p-4 mb-8 text-left text-xs font-mono bg-gray-50 dark:bg-muted border border-gray-100 dark:border-border text-gray-500 dark:text-muted-foreground break-all">
            <div className="font-bold text-gray-400 dark:text-muted-foreground/60 uppercase mb-1 tracking-tighter">Error Details:</div>
            {this.state.message}
          </div>

          <div className="flex flex-col gap-3">
            <Button
              onClick={this.handleReset}
              className="w-full bg-emerald-700 hover:bg-emerald-800 h-12 text-base font-semibold transition-all active:scale-[0.98]"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              {this.state.isNetworkError ? "Retry Connection" : "Attempt Recovery"}
            </Button>
            
            <Button
              variant="outline"
              onClick={() => {
                this.handleReset();
                window.location.href = "/";
              }}
              className="w-full border-emerald-100 dark:border-border text-emerald-700 dark:text-foreground hover:bg-emerald-50 dark:hover:bg-muted"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Return to Dashboard
            </Button>
          </div>
          
          <div className="mt-8 pt-6 border-t border-gray-50 dark:border-border text-[10px] text-gray-400 uppercase tracking-widest font-bold">
            AeroOps Premium Reliability System
          </div>
        </div>
      </div>
    );
  }
}
