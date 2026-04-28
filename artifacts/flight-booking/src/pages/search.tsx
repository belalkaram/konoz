import { useState } from "react";
import { useLocation } from "wouter";
import { useSearchOffers } from "@workspace/api-client-react";
import type { SearchOffersBody, PassengerInput, PassengerInputType, SearchOffersBodyCabinClass } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDuration, formatDateTime } from "@/lib/formatters";
import { Plane, Search as SearchIcon, ArrowRight, Clock, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

export default function Search() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [origin, setOrigin] = useState("LHR");
  const [destination, setDestination] = useState("JFK");
  const [departureDate, setDepartureDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });
  const [cabinClass, setCabinClass] = useState<SearchOffersBodyCabinClass>("economy");
  const [adults, setAdults] = useState(1);

  const searchOffers = useSearchOffers();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!origin || !destination || !departureDate) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    const passengers: PassengerInput[] = Array.from({ length: adults }).map(() => ({ type: "adult" as PassengerInputType }));

    const body: SearchOffersBody = {
      origin,
      destination,
      departureDate,
      passengers,
      cabinClass,
    };

    searchOffers.mutate({ data: body });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Flight Search</h1>
        <p className="text-muted-foreground mt-1">Search for live flight availability and pricing.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="grid gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="origin">Origin (IATA)</Label>
                <Input 
                  id="origin" 
                  value={origin} 
                  onChange={(e) => setOrigin(e.target.value.toUpperCase())}
                  placeholder="e.g. LHR"
                  maxLength={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="destination">Destination (IATA)</Label>
                <Input 
                  id="destination" 
                  value={destination} 
                  onChange={(e) => setDestination(e.target.value.toUpperCase())}
                  placeholder="e.g. JFK"
                  maxLength={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Departure Date</Label>
                <Input 
                  id="date" 
                  type="date"
                  value={departureDate} 
                  onChange={(e) => setDepartureDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cabin">Cabin Class</Label>
                <Select value={cabinClass} onValueChange={(v) => setCabinClass(v as SearchOffersBodyCabinClass)}>
                  <SelectTrigger id="cabin">
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="economy">Economy</SelectItem>
                    <SelectItem value="premium_economy">Premium Economy</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                    <SelectItem value="first">First Class</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={searchOffers.isPending} className="w-full md:w-auto">
                {searchOffers.isPending ? (
                  <span className="flex items-center gap-2">
                    <SearchIcon className="h-4 w-4 animate-spin" /> Searching...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <SearchIcon className="h-4 w-4" /> Search Flights
                  </span>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {searchOffers.isPending && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex justify-between items-center">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <Skeleton className="h-10 w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {searchOffers.isError && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="p-6 text-destructive flex items-center gap-3">
            <span className="font-medium">Search failed:</span>
            <span>{searchOffers.error?.message || "An unexpected error occurred."}</span>
          </CardContent>
        </Card>
      )}

      {searchOffers.isSuccess && searchOffers.data.offers.length === 0 && (
        <div className="text-center py-12 border rounded-lg bg-card">
          <Plane className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
          <h3 className="text-lg font-medium">No flights found</h3>
          <p className="text-muted-foreground">Try adjusting your search criteria or dates.</p>
        </div>
      )}

      {searchOffers.isSuccess && searchOffers.data.offers.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">
            {searchOffers.data.offers.length} offers found
          </h2>
          <div className="grid gap-4">
            {searchOffers.data.offers.map((offer) => {
              const slice = offer.slices[0]; // For simplicity, assume one slice
              const segments = slice?.segments || [];
              const firstSegment = segments[0];
              const lastSegment = segments[segments.length - 1];

              return (
                <Card key={offer.id} className="hover:border-primary/50 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
                      
                      <div className="flex items-center gap-6 flex-1 w-full">
                        {offer.owner?.logoSymbolUrl ? (
                          <img src={offer.owner.logoSymbolUrl} alt={offer.owner.name} className="w-12 h-12 object-contain" />
                        ) : (
                          <div className="w-12 h-12 bg-muted rounded flex items-center justify-center font-bold text-muted-foreground">
                            {offer.owner?.iataCode || "??"}
                          </div>
                        )}
                        
                        <div className="flex-1 grid grid-cols-3 gap-4 text-center items-center">
                          <div>
                            <div className="text-2xl font-bold">{firstSegment?.departureDateTime ? new Date(firstSegment.departureDateTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}</div>
                            <div className="text-sm font-medium">{slice?.origin.iataCode}</div>
                          </div>
                          
                          <div className="flex flex-col items-center px-4">
                            <div className="text-xs text-muted-foreground mb-1">{slice?.duration ? formatDuration(slice.duration) : ''}</div>
                            <div className="w-full relative flex items-center">
                              <div className="h-px bg-border w-full"></div>
                              <Plane className="h-4 w-4 text-muted-foreground absolute left-1/2 -translate-x-1/2 bg-card px-1" />
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {segments.length === 1 ? 'Direct' : `${segments.length - 1} stop(s)`}
                            </div>
                          </div>

                          <div>
                            <div className="text-2xl font-bold">{lastSegment?.arrivalDateTime ? new Date(lastSegment.arrivalDateTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}</div>
                            <div className="text-sm font-medium">{slice?.destination.iataCode}</div>
                          </div>
                        </div>
                      </div>

                      <div className="flex md:flex-col items-center md:items-end justify-between w-full md:w-auto gap-4 border-t md:border-t-0 md:border-l border-border pt-4 md:pt-0 md:pl-6">
                        <div className="text-right">
                          <div className="text-2xl font-bold text-primary">
                            {formatCurrency(offer.totalAmount, offer.totalCurrency)}
                          </div>
                          <div className="text-xs text-muted-foreground uppercase">{offer.cabinClass}</div>
                        </div>
                        <Button onClick={() => setLocation(`/offers/${offer.id}`)}>
                          Select Offer
                        </Button>
                      </div>
                      
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
