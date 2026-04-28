import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { PassengerInputType, SearchOffersBodyCabinClass, SearchOffersResponse } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDuration, formatDate } from "@/lib/formatters";
import { Plane, Search as SearchIcon, ArrowRight, Clock, Users, ArrowLeftRight, Luggage, ShoppingBag } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AirportCombobox } from "@/components/airport-combobox";
import { Input } from "@/components/ui/input";

interface SearchKey {
  origin: string;
  destination: string;
  departureDate: string;
  cabinClass: SearchOffersBodyCabinClass;
  adults: number;
}

async function fetchOffers(key: SearchKey): Promise<SearchOffersResponse> {
  const passengers = Array.from({ length: key.adults }).map(() => ({
    type: "adult" as PassengerInputType,
  }));
  const res = await fetch("/api/offers/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      origin: key.origin,
      destination: key.destination,
      departureDate: key.departureDate,
      passengers,
      cabinClass: key.cabinClass,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Search failed" }));
    throw new Error(err.message || "Search failed");
  }
  return res.json();
}

export default function Search() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();

  const defaultDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split("T")[0];
  };

  const [origin, setOrigin] = useState("LHR");
  const [destination, setDestination] = useState("JFK");
  const [departureDate, setDepartureDate] = useState(defaultDate);
  const [cabinClass, setCabinClass] = useState<SearchOffersBodyCabinClass>("economy");
  const [adults, setAdults] = useState(1);
  const [searchKey, setSearchKey] = useState<SearchKey | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const from = params.get("from");
    const to = params.get("to");
    const date = params.get("date");
    const cabin = (params.get("cabin") as SearchOffersBodyCabinClass) || "economy";
    const adultsCount = parseInt(params.get("adults") || "1", 10);
    if (from && to && date) {
      setOrigin(from);
      setDestination(to);
      setDepartureDate(date);
      setCabinClass(cabin);
      setAdults(adultsCount);
      setSearchKey({ origin: from, destination: to, departureDate: date, cabinClass: cabin, adults: adultsCount });
    }
  }, []);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["offers-search", searchKey],
    queryFn: () => fetchOffers(searchKey!),
    enabled: !!searchKey,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  function swapAirports() {
    const tmp = origin;
    setOrigin(destination);
    setDestination(tmp);
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!origin || !destination || !departureDate) {
      toast({
        title: "Missing fields",
        description: "Please fill in origin, destination, and date.",
        variant: "destructive",
      });
      return;
    }
    const key: SearchKey = { origin, destination, departureDate, cabinClass, adults };
    setSearchKey(key);
    setLocation(`/search?from=${origin}&to=${destination}&date=${departureDate}&cabin=${cabinClass}&adults=${adults}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Flight Search</h1>
        <p className="text-muted-foreground mt-1 text-sm md:text-base">
          Search live flight availability and pricing via Duffel.
        </p>
      </div>

      <Card>
        <CardContent className="pt-5 pb-5">
          <form onSubmit={handleSearch} className="space-y-5">
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1">
                <AirportCombobox
                  id="origin"
                  label="From"
                  value={origin}
                  onChange={setOrigin}
                  placeholder="City or IATA code"
                />
              </div>
              <button
                type="button"
                onClick={swapAirports}
                className="self-end sm:self-auto mb-0 sm:mb-0 p-2 rounded-full border border-border hover:bg-accent text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                title="Swap airports"
              >
                <ArrowLeftRight className="h-4 w-4" />
              </button>
              <div className="flex-1">
                <AirportCombobox
                  id="destination"
                  label="To"
                  value={destination}
                  onChange={setDestination}
                  placeholder="City or IATA code"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                <Label htmlFor="adults">Passengers</Label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAdults((a) => Math.max(1, a - 1))}
                    className="w-9 h-9 rounded border border-border flex items-center justify-center hover:bg-accent transition-colors font-bold text-lg"
                  >
                    −
                  </button>
                  <div className="flex-1 h-9 border border-input rounded flex items-center justify-center gap-2 text-sm font-medium bg-background">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    {adults} Adult{adults > 1 ? "s" : ""}
                  </div>
                  <button
                    type="button"
                    onClick={() => setAdults((a) => Math.min(9, a + 1))}
                    className="w-9 h-9 rounded border border-border flex items-center justify-center hover:bg-accent transition-colors font-bold text-lg"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cabin">Cabin Class</Label>
                <Select
                  value={cabinClass}
                  onValueChange={(v) => setCabinClass(v as SearchOffersBodyCabinClass)}
                >
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
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full sm:w-auto px-8"
              >
                {isLoading ? (
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

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <div className="flex justify-between items-center gap-4">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-36" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <Skeleton className="h-10 w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isError && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="p-5 text-destructive flex items-start gap-3">
            <span className="font-medium">Search failed:</span>
            <span>{(error as Error)?.message || "An unexpected error occurred."}</span>
          </CardContent>
        </Card>
      )}

      {data && data.offers.length === 0 && (
        <div className="text-center py-16 border rounded-lg bg-card">
          <Plane className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
          <h3 className="text-lg font-medium">No flights found</h3>
          <p className="text-muted-foreground text-sm mt-1">
            Try different dates or airports.
          </p>
        </div>
      )}

      {data && data.offers.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            {data.offers.length} offers found
          </h2>
          <div className="grid gap-3">
            {data.offers.map((offer) => {
              const slice = offer.slices[0];
              const segments = slice?.segments || [];
              const first = segments[0];
              const last = segments[segments.length - 1];

              const depTime = first?.departureDateTime
                ? new Date(first.departureDateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
                : "--:--";
              const arrTime = last?.arrivalDateTime
                ? new Date(last.arrivalDateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
                : "--:--";
              const depDate = first?.departureDateTime
                ? formatDate(first.departureDateTime)
                : "";

              const allBaggages = segments.flatMap((s) => s.baggages ?? []);
              const checkedBag = allBaggages.find((b) => b.type === "checked");
              const carryOn = allBaggages.find((b) => b.type === "carry_on");

              return (
                <Card
                  key={offer.id}
                  className="hover:border-primary/50 transition-colors"
                >
                  <CardContent className="p-4 md:p-5">
                    <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between">

                      {/* Airline + Route */}
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        {/* Airline logo + name */}
                        <div className="flex flex-col items-center gap-1 flex-shrink-0 w-14">
                          {offer.owner?.logoSymbolUrl ? (
                            <img
                              src={offer.owner.logoSymbolUrl}
                              alt={offer.owner.name}
                              className="w-10 h-10 object-contain"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-muted rounded flex items-center justify-center font-bold text-muted-foreground text-xs">
                              {offer.owner?.iataCode ?? "??"}
                            </div>
                          )}
                          <span className="text-xs text-muted-foreground text-center leading-tight line-clamp-2">
                            {offer.owner?.name}
                          </span>
                        </div>

                        <div className="flex-1 grid grid-cols-3 gap-2 text-center items-center min-w-0">
                          <div>
                            <div className="text-xl md:text-2xl font-bold tabular-nums">{depTime}</div>
                            <div className="text-sm font-semibold text-primary">{slice?.origin.iataCode}</div>
                            <div className="text-xs text-muted-foreground truncate hidden sm:block">
                              {slice?.origin.cityName}
                            </div>
                            {depDate && (
                              <div className="text-xs text-muted-foreground hidden sm:block">{depDate}</div>
                            )}
                          </div>

                          <div className="flex flex-col items-center px-2">
                            <div className="text-xs text-muted-foreground mb-1">
                              {slice?.duration ? formatDuration(slice.duration) : ""}
                            </div>
                            <div className="w-full flex items-center">
                              <div className="h-px bg-border flex-1" />
                              <Plane className="h-3 w-3 text-muted-foreground mx-1 flex-shrink-0" />
                              <div className="h-px bg-border flex-1" />
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {segments.length === 1 ? "Direct" : `${segments.length - 1} stop${segments.length > 2 ? "s" : ""}`}
                            </div>
                          </div>

                          <div>
                            <div className="text-xl md:text-2xl font-bold tabular-nums">{arrTime}</div>
                            <div className="text-sm font-semibold text-primary">{slice?.destination.iataCode}</div>
                            <div className="text-xs text-muted-foreground truncate hidden sm:block">
                              {slice?.destination.cityName}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Price + CTA */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 sm:gap-2 border-t sm:border-t-0 sm:border-l border-border pt-3 sm:pt-0 sm:pl-5 flex-shrink-0">
                        <div className="text-right">
                          <div className="text-xl md:text-2xl font-bold text-primary">
                            {formatCurrency(offer.totalAmount, offer.totalCurrency)}
                          </div>
                          <div className="text-xs text-muted-foreground uppercase tracking-wide">
                            {offer.cabinClass?.replace("_", " ")}
                          </div>
                          {/* Baggage summary */}
                          <div className="flex gap-1 justify-end mt-1 flex-wrap">
                            {checkedBag && checkedBag.quantity > 0 ? (
                              <Badge variant="secondary" className="text-xs gap-1 px-1.5 py-0.5">
                                <Luggage className="h-3 w-3" />
                                {checkedBag.quantity}✕ checked{checkedBag.maximumWeightKg ? ` · ${checkedBag.maximumWeightKg}kg` : ""}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs gap-1 px-1.5 py-0.5 text-muted-foreground">
                                <Luggage className="h-3 w-3" />
                                No checked bag
                              </Badge>
                            )}
                            {carryOn && carryOn.quantity > 0 && (
                              <Badge variant="secondary" className="text-xs gap-1 px-1.5 py-0.5">
                                <ShoppingBag className="h-3 w-3" />
                                {carryOn.quantity}✕ carry-on{carryOn.maximumWeightKg ? ` · ${carryOn.maximumWeightKg}kg` : ""}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          className="w-full sm:w-auto"
                          onClick={() => setLocation(`/offers/${offer.id}`)}
                        >
                          Select
                          <ArrowRight className="h-4 w-4 ml-1" />
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
