import { useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDuration, formatDateTime, formatTime } from "@/lib/formatters";
import { Plane, ArrowRight, Info, AlertCircle, Luggage, ShoppingBag, X, ExternalLink, RefreshCw, WifiOff, ArrowLeft } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getAirlineWebsite } from "@/lib/airlines";
import { authFetch, BASE } from "@/lib/api";
import { useLanguage } from "@/contexts/language-context";
import { cn } from "@/lib/utils";

async function fetchOffer(offerId: string) {
  const res = await authFetch(`${BASE}/api/offers/${offerId}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = Object.assign(
      new Error(body.message || "Failed to load offer"),
      { status: res.status, code: body.error }
    );
    throw err;
  }
  return body;
}

function getSessionOffer(offerId: string) {
  try {
    const raw = sessionStorage.getItem(`offer_${offerId}`);
    if (raw) return JSON.parse(raw);
  } catch { }
  return null;
}

export default function OfferDetail() {
  const [, params] = useRoute("/offers/:offerId");
  const [, setLocation] = useLocation();
  const { t, language, isRtl } = useLanguage();
  const offerId = params?.offerId ?? "";

  const displayCurrency = (localStorage.getItem("displayCurrency") || "KWD") as string;

  const cachedOffer = useMemo(() => getSessionOffer(offerId), [offerId]);

  const {
    data: freshOffer,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["offer", offerId],
    queryFn: () => fetchOffer(offerId),
    enabled: !!offerId && !cachedOffer,
    initialData: cachedOffer,
    retry: (count, err: unknown) => {
      const e = err as { status?: number };
      if (e?.status === 404 || e?.status === 410 || e?.status === 502) return false;
      return count < 2;
    },
    staleTime: Infinity,
  });

  const offer = freshOffer ?? (isError ? cachedOffer : null);
  const usingCache = !freshOffer && isError && !!cachedOffer;
  const apiError = error as { status?: number; message?: string } | null;
  const isAirlineError = apiError?.status === 502;
  const isExpired = apiError?.status === 404;

  if (isLoading && !cachedOffer) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError && !cachedOffer) {
    return (
      <div className="space-y-4 text-start">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>
            {isAirlineError
              ? (language === "ar" ? "خطأ في نظام شركة الطيران" : "Airline System Error")
              : isExpired
              ? (language === "ar" ? "انتهت صلاحية العرض" : "Offer Expired")
              : (language === "ar" ? "خطأ" : "Error")}
          </AlertTitle>
          <AlertDescription>
            {isAirlineError
              ? (language === "ar" ? "أعاد نظام شركة الطيران خطأً. هذه مشكلة مؤقتة من جانب شركة الطيران، يرجى العودة ومحاولة اختيار الرحلة مجدداً." : "The airline's system returned an error. This is a temporary issue on the airline's side. Please go back and try selecting the flight again.")
              : isExpired
              ? (language === "ar" ? "هذا العرض لم يعد متاحاً. ربما انتهت صلاحيته، يرجى البحث مجدداً للحصول على نتائج محدثة." : "This offer is no longer available. It may have expired. Please search again for updated results.")
              : apiError?.message || (language === "ar" ? "فشل تحميل تفاصيل العرض." : "Failed to load offer details.")}
          </AlertDescription>
        </Alert>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-1.5" onClick={() => setLocation("/search")}>
            {isRtl ? "العودة للبحث →" : "← Back to Search"}
          </Button>
          {isAirlineError && (
            <Button className="gap-1.5" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
              {language === "ar" ? "إعادة المحاولة" : "Try Again"}
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (!offer) return null;

  return (
    <div className="space-y-8 max-w-5xl mx-auto text-start">
      {usingCache && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-800">
          <WifiOff className="h-4 w-4" />
          <AlertTitle className="text-amber-900">
            {isAirlineError
              ? (language === "ar" ? "نظام شركة الطيران غير متوفر مؤقتاً" : "Airline system temporarily unavailable")
              : (language === "ar" ? "يتم استخدام السعر المخزن مؤقتاً" : "Using cached pricing")}
          </AlertTitle>
          <AlertDescription className="text-amber-700">
            {isAirlineError
              ? (language === "ar" ? "أعاد نظام شركة الطيران خطأً — يتم عرض السعر من نتائج بحثك. تأكد من السعر المباشر قبل الحجز." : "The airline's system returned an error — showing the pricing from your search. Confirm live pricing before booking.")
              : (language === "ar" ? "تعذر تحديث تسعير العرض. يتم عرض البيانات من نتائج بحثك." : "Could not refresh offer pricing. Showing data from your search results.")}
            <Button
              variant="link"
              size="sm"
              className="ms-2 h-auto p-0 text-amber-800 underline"
              onClick={() => refetch()}
            >
              {language === "ar" ? "حاول التحديث" : "Try refreshing"}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            size="sm"
            className="w-fit rounded-full text-muted-foreground hover:text-primary hover:border-primary/50 shadow-sm transition-all hover:bg-primary/5 group gap-2 px-4"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className={cn("h-4 w-4 transition-transform group-hover:translate-x-1", isRtl && "scale-x-[-1]")} />
            {language === "ar" ? "عودة لنتائج البحث" : "Back to Search"}
          </Button>
          <div className="flex items-center gap-4">
            {offer.owner?.logoSymbolUrl && (
              <img src={offer.owner.logoSymbolUrl} alt={offer.owner.name ?? ""} className="w-12 h-12 object-contain" />
            )}
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {language === "ar" ? "تفاصيل عرض الرحلة" : "Offer Details"}
              </h1>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-muted-foreground text-sm">{offer.owner?.name}</p>
                {offer.owner?.iataCode && getAirlineWebsite(offer.owner.iataCode) && (
                  <a
                    href={getAirlineWebsite(offer.owner.iataCode)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {language === "ar" ? "الموقع الرسمي" : "Official Website"}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="text-end">
          <div className="text-3xl font-bold text-primary">
            {formatCurrency(offer.totalAmount, offer.totalCurrency, displayCurrency)}
          </div>
          <div className="text-sm text-muted-foreground">
            {language === "ar" ? "السعر الإجمالي (شامل الضرائب)" : "Total Price (incl. taxes)"}
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          {offer.slices.map((slice: typeof offer.slices[0]) => (
            <Card key={slice.id}>
              <CardHeader className="bg-muted/50 border-b border-border pb-4">
                <CardTitle className="text-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>{slice.origin.cityName || slice.origin.name}</span>
                    <ArrowRight className={cn("h-4 w-4 text-muted-foreground", isRtl && "scale-x-[-1]")} />
                    <span>{slice.destination.cityName || slice.destination.name}</span>
                  </div>
                  <span className="text-sm font-normal text-muted-foreground">
                    {slice.duration && formatDuration(slice.duration)}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="flex flex-col">
                  {slice.segments?.map((segment: typeof slice.segments[0]) => (
                    <div key={segment.id} className="relative p-6 border-b border-border last:border-0">
                      <div className="flex gap-6 text-start">
                        <div className="flex flex-col items-center min-w-12">
                          <div className="text-sm font-bold">{formatTime(segment.departureDateTime)}</div>
                          <div className="text-xs text-muted-foreground">{segment.origin.iataCode}</div>
                          <div className="w-px h-full bg-border my-2 flex-1"></div>
                          <div className="text-sm font-bold">{formatTime(segment.arrivalDateTime)}</div>
                          <div className="text-xs text-muted-foreground">{segment.destination.iataCode}</div>
                        </div>

                        <div className="flex-1 pt-1 min-w-0">
                          <div className="font-medium truncate">
                            {segment.origin.name} ({segment.origin.iataCode}) — {segment.origin.terminal ? (language === "ar" ? `مبنى ركاب ${segment.origin.terminal}` : `Terminal ${segment.origin.terminal}`) : (language === "ar" ? "مبنى الركاب: غير متوفر" : "Terminal: Not Available")}
                          </div>
                          <div className="text-sm text-muted-foreground mb-4">{formatDateTime(segment.departureDateTime)}</div>

                          <div className="flex flex-wrap items-center gap-2 text-sm bg-muted/50 w-fit px-3 py-1.5 rounded-md mb-3">
                            <Plane className="h-3 w-3" />
                            <span>{segment.operatingCarrier?.name || segment.marketingCarrier?.name} {segment.flightNumber}</span>
                            <span className="text-muted-foreground">&bull;</span>
                            <span className="text-muted-foreground">{segment.duration && formatDuration(segment.duration)}</span>
                            {segment.aircraft?.name && (
                              <>
                                <span className="text-muted-foreground">&bull;</span>
                                <span className="text-muted-foreground">{segment.aircraft.name}</span>
                              </>
                            )}
                          </div>

                          {/* Baggage allowance */}
                          <div className="flex flex-wrap gap-2 mb-4">
                            {(segment.baggages && segment.baggages.length > 0) ? (
                              segment.baggages.map((bag: typeof segment.baggages[0], bi: number) => (
                                <Badge key={bi} variant="secondary" className="gap-1.5 text-xs py-1">
                                  {bag.type === "checked" ? (
                                    <Luggage className="h-3.5 w-3.5" />
                                  ) : (
                                    <ShoppingBag className="h-3.5 w-3.5" />
                                  )}
                                  {bag.quantity > 0
                                    ? `${bag.quantity}× ${bag.type === "checked" ? (language === "ar" ? "حقيبة مسجلة" : "Checked bag") : (language === "ar" ? "حقيبة يد" : "Carry-on")}${bag.maximumWeightKg ? ` · ${bag.maximumWeightKg}kg` : ""}`
                                    : (language === "ar" ? `لا تتوفر ${bag.type === "checked" ? "حقائب مسجلة" : "حقائب يد"}` : `No ${bag.type === "checked" ? "checked bag" : "carry-on"}`)}
                                </Badge>
                              ))
                            ) : (
                              <Badge variant="outline" className="gap-1.5 text-xs py-1 text-muted-foreground">
                                <X className="h-3.5 w-3.5" />
                                {language === "ar" ? "لا تتوفر معلومات عن الأمتعة" : "No baggage info available"}
                              </Badge>
                            )}
                          </div>

                          <div className="font-medium truncate">
                            {segment.destination.name} ({segment.destination.iataCode}) — {segment.destination.terminal ? (language === "ar" ? `مبنى ركاب ${segment.destination.terminal}` : `Terminal ${segment.destination.terminal}`) : (language === "ar" ? "مبنى الركاب: غير متوفر" : "Terminal: Not Available")}
                          </div>
                          <div className="text-sm text-muted-foreground">{formatDateTime(segment.arrivalDateTime)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{language === "ar" ? "تفاصيل السعر" : "Price Breakdown"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{language === "ar" ? "سعر التذكرة الأساسي" : "Base Fare"}</span>
                <span>{offer.baseAmount ? formatCurrency(offer.baseAmount, offer.totalCurrency, displayCurrency) : "-"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{language === "ar" ? "الضرائب والرسوم" : "Taxes & Fees"}</span>
                <span>{offer.taxAmount ? formatCurrency(offer.taxAmount, offer.totalCurrency, displayCurrency) : "-"}</span>
              </div>
              <div className="pt-4 border-t border-border flex justify-between font-bold">
                <span>{language === "ar" ? "المجموع الكلي" : "Total"}</span>
                <span className="text-primary">{formatCurrency(offer.totalAmount, offer.totalCurrency, displayCurrency)}</span>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full" size="lg" onClick={() => setLocation(`/orders/new?offerId=${offer.id}`)}>
                {language === "ar" ? "المتابعة لإدخال بيانات الركاب" : "Continue to Passenger Details"}
              </Button>
            </CardFooter>
          </Card>

          {offer.availableBaggageServices && offer.availableBaggageServices.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Luggage className="h-4 w-4 text-primary" />
                  {language === "ar" ? "أمتعة إضافية متاحة للشراء" : "Extra Baggage Available"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {offer.availableBaggageServices.map((svc: typeof offer.availableBaggageServices[0]) => (
                  <div key={svc.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      {svc.type === "checked" ? (
                        <Luggage className="h-3.5 w-3.5 flex-shrink-0" />
                      ) : (
                        <ShoppingBag className="h-3.5 w-3.5 flex-shrink-0" />
                      )}
                      <span>
                        {svc.type === "checked" ? (language === "ar" ? "حقيبة مسجلة" : "Checked bag") : (language === "ar" ? "حقيبة يد" : "Carry-on")}
                        {svc.maximumWeightKg ? ` · ${svc.maximumWeightKg}kg` : ""}
                        {svc.maximumHeightCm && svc.maximumLengthCm && svc.maximumDepthCm
                          ? ` · ${svc.maximumHeightCm}×${svc.maximumLengthCm}×${svc.maximumDepthCm}cm`
                          : ""}
                      </span>
                    </div>
                    <span className="font-medium text-primary">
                      +{formatCurrency(svc.totalAmount, svc.totalCurrency, displayCurrency)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground flex gap-3 text-start">
            <Info className="h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-medium text-foreground mb-1">{language === "ar" ? "معلومات هامة" : "Important Information"}</p>
              <p>
                {language === "ar"
                  ? "الأسعار غير مضمونة حتى يتم إصدار التذكرة فعلياً. يرجى التأكد من تطابق جميع أسماء المسافرين مع وثيقة السفر الرسمية تماماً."
                  : "Fares are not guaranteed until ticketed. Please ensure all passenger names match their government-issued ID exactly."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
