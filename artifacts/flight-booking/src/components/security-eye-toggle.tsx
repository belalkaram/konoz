import React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSecurityEye } from "@/hooks/use-security-eye";
import { useLanguage } from "@/contexts/language-context";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function SecurityEyeToggle() {
  const { isVisible, toggleVisibility } = useSecurityEye();
  const { language } = useLanguage();

  const tooltipText = isVisible
    ? (language === "ar" ? "إخفاء البيانات" : "Hide sensitive data")
    : (language === "ar" ? "إظهار البيانات" : "Show sensitive data");

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={toggleVisibility}
            className="w-9 h-9 border-border/40 hover:bg-accent hover:text-accent-foreground flex-shrink-0"
          >
            {isVisible ? (
              <Eye className="h-4 w-4" />
            ) : (
              <EyeOff className="h-4 w-4 text-red-500" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
