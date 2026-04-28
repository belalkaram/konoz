import { useRoute, useLocation } from "wouter";
import { useGetOffer, getGetOfferQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDuration, formatDateTime } from "@/lib/formatters";
import { Plane, ArrowRight, Info, AlertCircle, Luggage, ShoppingBag, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function OfferDetail() {
  const [, params] = useRoute("/offers/:offerId");
  const [, setLocation] = useLocation();
  const offerId = params?.offerId;

  const { data: offer, isLoading, isError } = useGetOffer(offerId || "", {
    query: {
      enabled: !!offerId,
      queryKey: getGetOfferQueryKey(offerId || "")
    }
  });

  if (isLoading) {
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

  if (isError || !offer) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Failed to load offer details. The offer may have expired.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Offer Details</h1>
          <p className="text-muted-foreground mt-1">Review itinerary and complete your booking.</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-primary">
            {formatCurrency(offer.totalAmount, offer.totalCurrency)}
          </div>
          <div className="text-sm text-muted-foreground">Total Price (incl. taxes)</div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          {offer.slices.map((slice, i) => (
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
                  {slice.segments?.map((segment, j) => (
                    <div key={segment.id} className="relative p-6 border-b border-border last:border-0">
                      <div className="flex gap-6">
                        <div className="flex flex-col items-center min-w-12">
                          <div className="text-sm font-bold">{new Date(segment.departureDateTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                          <div className="text-xs text-muted-foreground">{segment.origin.iataCode}</div>
                          
                          <div className="w-px h-full bg-border my-2 flex-1"></div>
                          
                          <div className="text-sm font-bold">{new Date(segment.arrivalDateTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                          <div className="text-xs text-muted-foreground">{segment.destination.iataCode}</div>
                        </div>
                        
                        <div className="flex-1 pt-1">
                          <div className="font-medium">{segment.origin.name}</div>
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
                              segment.baggages.map((bag, bi) => (
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
                          
                          <div className="font-medium">{segment.destination.name}</div>
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
                <span>{offer.baseAmount ? formatCurrency(offer.baseAmount, offer.totalCurrency) : '-'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Taxes & Fees</span>
                <span>{offer.taxAmount ? formatCurrency(offer.taxAmount, offer.totalCurrency) : '-'}</span>
              </div>
              <div className="pt-4 border-t border-border flex justify-between font-bold">
                <span>Total</span>
                <span className="text-primary">{formatCurrency(offer.totalAmount, offer.totalCurrency)}</span>
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
                {offer.availableBaggageServices.map((svc) => (
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
                      +{formatCurrency(svc.totalAmount, svc.totalCurrency)}
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
