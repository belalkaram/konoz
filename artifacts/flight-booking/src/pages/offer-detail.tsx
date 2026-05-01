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
  const offerId = params?.offerId ?? "";

  const displayCurrency = (localStorage.getItem("displayCurrency") || "USD") as string;

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
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{isAirlineError ? "Airline System Error" : isExpired ? "Offer Expired" : "Error"}</AlertTitle>
          <AlertDescription>
            {isAirlineError
              ? "The airline's system returned an error. This is a temporary issue on the airline's side. Please go back and try selecting the flight again."
              : isExpired
                ? "This offer is no longer available. It may have expired. Please search again for updated results."
                : apiError?.message || "Failed to load offer details."}
          </AlertDescription>
        </Alert>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setLocation("/search")}>
            ← Back to Search
          </Button>
          {isAirlineError && (
            <Button onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (!offer) return null;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {usingCache && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-800">
          <WifiOff className="h-4 w-4" />
          <AlertTitle className="text-amber-900">
            {isAirlineError ? "Airline system temporarily unavailable" : "Using cached pricing"}
          </AlertTitle>
          <AlertDescription className="text-amber-700">
            {isAirlineError
              ? "The airline's system returned an error — showing the pricing from your search. Confirm live pricing before booking."
              : "Could not refresh offer pricing. Showing data from your search results."}
            <Button
              variant="link"
              size="sm"
              className="ml-2 h-auto p-0 text-amber-800 underline"
              onClick={() => refetch()}
            >
              Try refreshing
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
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            عودة لنتائج البحث
          </Button>
          <div className="flex items-center gap-4">
            {offer.owner?.logoSymbolUrl && (
              <img src={offer.owner.logoSymbolUrl} alt={offer.owner.name ?? ""} className="w-12 h-12 object-contain" />
            )}
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Offer Details</h1>
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
                    Official Website
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-primary">
            {formatCurrency(offer.totalAmount, offer.totalCurrency, displayCurrency)}
          </div>
          <div className="text-sm text-muted-foreground">Total Price (incl. taxes)</div>
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
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
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
                      <div className="flex gap-6">
                        <div className="flex flex-col items-center min-w-12">
                          <div className="text-sm font-bold">{formatTime(segment.departureDateTime)}</div>
                          <div className="text-xs text-muted-foreground">{segment.origin.iataCode}</div>
                          <div className="w-px h-full bg-border my-2 flex-1"></div>
                          <div className="text-sm font-bold">{formatTime(segment.arrivalDateTime)}</div>
                          <div className="text-xs text-muted-foreground">{segment.destination.iataCode}</div>
                        </div>

                        <div className="flex-1 pt-1">
                          <div className="font-medium">
                            {segment.origin.name} ({segment.origin.iataCode}) — {segment.origin.terminal ? `Terminal ${segment.origin.terminal}` : "Terminal: Not Available"}
                          </div>
                          <div className="text-sm text-muted-foreground mb-4">{formatDateTime(segment.departureDateTime)}</div>

                          <div className="flex items-center gap-2 text-sm bg-muted/50 w-fit px-3 py-1.5 rounded-md mb-3">
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
                                    ? `${bag.quantity}× ${bag.type === "checked" ? "Checked bag" : "Carry-on"}${bag.maximumWeightKg ? ` · ${bag.maximumWeightKg}kg` : ""}`
                                    : `No ${bag.type === "checked" ? "checked bag" : "carry-on"}`}
                                </Badge>
                              ))
                            ) : (
                              <Badge variant="outline" className="gap-1.5 text-xs py-1 text-muted-foreground">
                                <X className="h-3.5 w-3.5" />
                                No baggage info available
                              </Badge>
                            )}
                          </div>

                          <div className="font-medium">
                            {segment.destination.name} ({segment.destination.iataCode}) — {segment.destination.terminal ? `Terminal ${segment.destination.terminal}` : "Terminal: Not Available"}
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
              <CardTitle className="text-lg">Price Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Base Fare</span>
                <span>{offer.baseAmount ? formatCurrency(offer.baseAmount, offer.totalCurrency, displayCurrency) : '-'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Taxes & Fees</span>
                <span>{offer.taxAmount ? formatCurrency(offer.taxAmount, offer.totalCurrency, displayCurrency) : '-'}</span>
              </div>
              <div className="pt-4 border-t border-border flex justify-between font-bold">
                <span>Total</span>
                <span className="text-primary">{formatCurrency(offer.totalAmount, offer.totalCurrency, displayCurrency)}</span>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full" size="lg" onClick={() => setLocation(`/orders/new?offerId=${offer.id}`)}>
                Continue to Passenger Details
              </Button>
            </CardFooter>
          </Card>

          {offer.availableBaggageServices && offer.availableBaggageServices.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Luggage className="h-4 w-4 text-primary" />
                  Extra Baggage Available
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
                        {svc.type === "checked" ? "Checked bag" : "Carry-on"}
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

          <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground flex gap-3">
            <Info className="h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-medium text-foreground mb-1">Important Information</p>
              <p>Fares are not guaranteed until ticketed. Please ensure all passenger names match their government-issued ID exactly.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
