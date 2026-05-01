import { Check, X, Info } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface FarePackage {
  id: string;
  name: string;
  cabin: string;
  price: number;
  priceDifference: number;
  currency: string;
  baggage: any[];
  refundable: boolean;
  changeable: boolean;
  sourceOfferId: string;
  available: boolean;
}

interface FarePackageCardsProps {
  packages: FarePackage[];
  displayCurrency: string;
  onSelect: (packageId: string) => void;
}

export function FarePackageCards({ packages, displayCurrency, onSelect }: FarePackageCardsProps) {
  if (!packages || packages.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-border flex gap-3 overflow-x-auto pb-2 scrollbar-hide" dir="rtl">
      {packages.map((pkg) => {
        const isCheapest = pkg.priceDifference === 0;

        return (
          <div
            key={pkg.id}
            className={`flex-shrink-0 w-64 rounded-xl border flex flex-col overflow-hidden bg-blue-50/50 dark:bg-blue-950/20 ${
              isCheapest ? "border-blue-200 dark:border-blue-800" : "border-border"
            }`}
          >
            <div className={`p-3 text-center ${isCheapest ? "bg-blue-100/50 dark:bg-blue-900/30" : "bg-muted/30"}`}>
              <h4 className="font-bold text-base text-foreground">{pkg.name}</h4>
              <div className="text-xs text-muted-foreground uppercase mt-0.5">{pkg.cabin.replace("_", " ")}</div>
            </div>

            <div className="p-4 flex-1 flex flex-col gap-3">
              <div className="text-center">
                <div className="text-xl font-bold text-primary">
                  {formatCurrency(pkg.price.toString(), pkg.currency, displayCurrency)}
                </div>
                {!isCheapest && (
                  <div className="text-xs font-medium text-muted-foreground mt-0.5">
                    + {formatCurrency(pkg.priceDifference.toString(), pkg.currency, displayCurrency)}
                  </div>
                )}
              </div>

              <div className="space-y-2 mt-2 flex-1">
                {pkg.baggage.length > 0 ? (
                  pkg.baggage.map((bag, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Check className="h-3.5 w-3.5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span>{bag.type === "checked" ? "حقيبة شحن" : "حقيبة يد"} {bag.maximumWeightKg ? `(${bag.maximumWeightKg} كجم)` : ""}</span>
                    </div>
                  ))
                ) : (
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <X className="h-3.5 w-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                    <span>بدون حقائب إضافية</span>
                  </div>
                )}

                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  {pkg.refundable ? (
                    <Check className="h-3.5 w-3.5 text-green-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <X className="h-3.5 w-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                  )}
                  <span>{pkg.refundable ? "قابل للاسترداد" : "غير قابل للاسترداد"}</span>
                </div>

                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  {pkg.changeable ? (
                    <Check className="h-3.5 w-3.5 text-green-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <X className="h-3.5 w-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                  )}
                  <span>{pkg.changeable ? "قابل للتعديل" : "غير قابل للتعديل"}</span>
                </div>
              </div>

              <Button
                className={`w-full mt-2 font-bold ${isCheapest ? "" : "bg-yellow-500 hover:bg-yellow-600 text-yellow-950"}`}
                variant={isCheapest ? "outline" : "default"}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(pkg.sourceOfferId);
                }}
              >
                اختار
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
