import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, icon: Icon, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 pb-4 border-b border-border/40", className)}>
      <div className="flex items-center gap-3">
        {Icon && (
          <div 
            className="w-11 h-11 rounded-xl flex items-center justify-center shadow-md flex-shrink-0 text-white animate-in zoom-in-95 duration-300"
            style={{ background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 75%, #10b981 100%)" }}
          >
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            {title}
          </h1>
          {description && (
            <p className="text-muted-foreground mt-0.5 text-xs md:text-sm">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-wrap sm:justify-end animate-in fade-in duration-300">
          {actions}
        </div>
      )}
    </div>
  );
}
