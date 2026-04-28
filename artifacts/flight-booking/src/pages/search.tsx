import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { PassengerInputType, SearchOffersBodyCabinClass, SearchOffersResponse } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDuration, formatShortDate } from "@/lib/formatters";
import { getAirlineWebsite } from "@/lib/airlines";
import { Plane, Search as SearchIcon, ArrowRight, Clock, Users, ArrowLeftRight, Luggage, ShoppingBag, ExternalLink, Filter, CheckCircle2, Circle, RotateCcw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AirportCombobox } from "@/components/airport-combobox";
import { Input } from "@/components/ui/input";
import { authFetch, BASE } from "@/lib/api";

type TripType = "one_way" | "round_trip";
type StopsFilter = "all" | "nonstop" | "stops";
type DisplayCurrency = "USD" | "EGP" | "KWD" | "SAR";

const CURRENCY_LABELS: Record<DisplayCurrency, string> = {
  USD: "$ USD",
  EGP: "EGP £",
  KWD: "KD KWD",
  SAR: "SR SAR",
};

interface SearchKey {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  cabinClass: SearchOffersBodyCabinClass;
  adults: number;
  tripType: TripType;
}

async function fetchOffers(key: SearchKey): Promise<SearchOffersResponse> {
  const passengers = Array.from({ length: key.adults }).map(() => ({
    type: "adult" as PassengerInputType,
  }));
  const body: Record<string, unknown> = {
    origin: key.origin,
    destination: key.destination,
    departureDate: key.departureDate,
    passengers,
    cabinClass: key.cabinClass,
  };
  if (key.tripType === "round_trip" && key.returnDate) {
    body.returnDate = key.returnDate;
  }
  const res = await authFetch(`${BASE}/api/offers/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Search failed" }));
    throw new Error(err.message || "Search failed");
  }
  return res.json();
}

const addDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
};

export default function Search() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [origin, setOrigin] = useState("CAI");
  const [destination, setDestination] = useState("KWI");
  const [departureDate, setDepartureDate] = useState(() => addDays(14));
  const [returnDate, setReturnDate] = useState(() => addDays(21));
  const [tripType, setTripType] = useState<TripType>("one_way");
  const [cabinClass, setCabinClass] = useState<SearchOffersBodyCabinClass>("economy");
  const [adults, setAdults] = useState(1);
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>(
    () => (localStorage.getItem("displayCurrency") as DisplayCurrency) || "USD"
  );
  const [searchKey, setSearchKey] = useState<SearchKey | null>(null);

  const [stopsFilter, setStopsFilter] = useState<StopsFilter>("all");
  const [selectedAirlines, setSelectedAirlines] = useState<Set<string>>(new Set());

  useEffect(() => {
    localStorage.setItem("displayCurrency", displayCurrency);
  }, [displayCurrency]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const from = params.get("from");
    const to = params.get("to");
    const date = params.get("date");
    const ret = params.get("return");
    const cabin = (params.get("cabin") as SearchOffersBodyCabinClass) || "economy";
    const adultsCount = parseInt(params.get("adults") || "1", 10);
    const trip = (params.get("trip") as TripType) || "one_way";
    if (from && to && date) {
      setOrigin(from);
      setDestination(to);
      setDepartureDate(date);
      if (ret) setReturnDate(ret);
      setCabinClass(cabin);
      setAdults(adultsCount);
      setTripType(trip);
      setSearchKey({ origin: from, destination: to, departureDate: date, returnDate: ret ?? undefined, cabinClass: cabin, adults: adultsCount, tripType: trip });
    }
  }, []);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["offers-search", searchKey],
    queryFn: () => fetchOffers(searchKey!),
    enabled: !!searchKey,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const availableAirlines = useMemo(() => {
    if (!data?.offers) return [];
    const map = new Map<string, { name: string; logo?: string | null }>();
    for (const offer of data.offers) {
      const code = offer.owner?.iataCode;
      if (code && !map.has(code)) {
        map.set(code, { name: offer.owner?.name ?? code, logo: offer.owner?.logoSymbolUrl });
      }
    }
    return Array.from(map.entries()).map(([code, info]) => ({ code, ...info }));
  }, [data]);

  const filteredOffers = useMemo(() => {
    if (!data?.offers) return [];
    return data.offers.filter((offer) => {
      const slice = offer.slices?.[0];
      const segCount = slice?.segments?.length ?? 1;

      if (stopsFilter === "nonstop" && segCount !== 1) return false;
      if (stopsFilter === "stops" && segCount === 1) return false;

      if (selectedAirlines.size > 0 && offer.owner?.iataCode) {
        if (!selectedAirlines.has(offer.owner.iataCode)) return false;
      }

      return true;
    });
  }, [data, stopsFilter, selectedAirlines]);

  function swapAirports() {
    setOrigin(destination);
    setDestination(origin);
  }

  function toggleAirline(code: string) {
    setSelectedAirlines((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!origin || !destination || !departureDate) {
      toast({ title: "Missing fields", description: "Please fill in origin, destination, and date.", variant: "destructive" });
      return;
    }
    if (tripType === "round_trip" && !returnDate) {
      toast({ title: "Missing return date", description: "Please select a return date for round trip.", variant: "destructive" });
      return;
    }
    setSelectedAirlines(new Set());
    setStopsFilter("all");
    const key: SearchKey = { origin, destination, departureDate, returnDate: tripType === "round_trip" ? returnDate : undefined, cabinClass, adults, tripType };
    setSearchKey(key);
    let url = `/search?from=${origin}&to=${destination}&date=${departureDate}&cabin=${cabinClass}&adults=${adults}&trip=${tripType}`;
    if (tripType === "round_trip" && returnDate) url += `&return=${returnDate}`;
    setLocation(url);
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
          <form onSubmit={handleSearch} className="space-y-4">
            {/* Trip type row */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTripType("one_way")}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${tripType === "one_way" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-accent"}`}
              >
                One Way
              </button>
              <button
                type="button"
                onClick={() => setTripType("round_trip")}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors flex items-center gap-1.5 ${tripType === "round_trip" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-accent"}`}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Round Trip
              </button>
            </div>

            {/* Airport row */}
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1">
                <AirportCombobox id="origin" label="From" value={origin} onChange={setOrigin} placeholder="City or IATA code" />
              </div>
              <button
                type="button"
                onClick={swapAirports}
                className="self-end sm:self-auto p-2 rounded-full border border-border hover:bg-accent text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                title="Swap airports"
              >
                <ArrowLeftRight className="h-4 w-4" />
              </button>
              <div className="flex-1">
                <AirportCombobox id="destination" label="To" value={destination} onChange={setDestination} placeholder="City or IATA code" />
              </div>
            </div>

            {/* Dates + Passengers + Class + Currency */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="date">Departure</Label>
                <Input id="date" type="date" value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} />
              </div>

              {tripType === "round_trip" && (
                <div className="space-y-1.5">
                  <Label htmlFor="return-date">Return</Label>
                  <Input id="return-date" type="date" value={returnDate} min={departureDate} onChange={(e) => setReturnDate(e.target.value)} />
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Passengers</Label>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => setAdults((a) => Math.max(1, a - 1))} className="w-9 h-9 rounded-full border border-border flex items-center justify-center hover:bg-accent transition-colors font-bold text-base flex-shrink-0">−</button>
                  <div className="flex-1 h-9 border border-input rounded-full flex items-center justify-center gap-1.5 text-sm font-medium bg-background px-3">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    {adults} Adult{adults > 1 ? "s" : ""}
                  </div>
                  <button type="button" onClick={() => setAdults((a) => Math.min(9, a + 1))} className="w-9 h-9 rounded-full border border-border flex items-center justify-center hover:bg-accent transition-colors font-bold text-base flex-shrink-0">+</button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cabin">Class</Label>
                <Select value={cabinClass} onValueChange={(v) => setCabinClass(v as SearchOffersBodyCabinClass)}>
                  <SelectTrigger id="cabin"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="economy">Economy</SelectItem>
                    <SelectItem value="premium_economy">Prem. Economy</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                    <SelectItem value="first">First</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="currency">Currency</Label>
                <Select value={displayCurrency} onValueChange={(v) => setDisplayCurrency(v as DisplayCurrency)}>
                  <SelectTrigger id="currency"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(CURRENCY_LABELS) as [DisplayCurrency, string][]).map(([code, label]) => (
                      <SelectItem key={code} value={code}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={isLoading} className="w-full sm:w-auto px-8">
                {isLoading ? (
                  <span className="flex items-center gap-2"><SearchIcon className="h-4 w-4 animate-spin" /> Searching...</span>
                ) : (
                  <span className="flex items-center gap-2"><SearchIcon className="h-4 w-4" /> Search Flights</span>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}><CardContent className="p-5"><div className="flex justify-between items-center gap-4"><div className="space-y-2 flex-1"><Skeleton className="h-5 w-36" /><Skeleton className="h-4 w-24" /></div><Skeleton className="h-10 w-24" /></div></CardContent></Card>
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

      {data && (
        <div className="space-y-4">
          {/* Filters bar */}
          <div className="flex flex-wrap gap-3 items-start">
            {/* Stops filter */}
            <div className="flex items-center gap-1.5 bg-muted/50 rounded-lg p-1">
              {(["all", "nonstop", "stops"] as StopsFilter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setStopsFilter(f)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${stopsFilter === f ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {f === "all" ? "All flights" : f === "nonstop" ? "Non-stop" : "1+ Stops"}
                </button>
              ))}
            </div>

            {/* Airline chips */}
            {availableAirlines.length > 1 && (
              <div className="flex flex-wrap gap-1.5 items-center">
                <Filter className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                {availableAirlines.map(({ code, name, logo }) => {
                  const active = selectedAirlines.size === 0 || selectedAirlines.has(code);
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => toggleAirline(code)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors ${selectedAirlines.has(code) ? "border-primary bg-primary/10 text-primary" : selectedAirlines.size === 0 ? "border-border bg-background text-foreground hover:border-primary/50" : "border-border bg-muted/40 text-muted-foreground hover:border-border"}`}
                    >
                      {logo ? (
                        <img src={logo} alt={name} className="w-4 h-4 object-contain" />
                      ) : (
                        <span className="font-bold text-[10px]">{code}</span>
                      )}
                      {name.length > 16 ? code : name}
                    </button>
                  );
                })}
                {selectedAirlines.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedAirlines(new Set())}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">
              {filteredOffers.length} of {data.offers.length} flights
              {tripType === "round_trip" ? " · Round trip" : " · One way"}
            </h2>
          </div>

          {filteredOffers.length === 0 ? (
            <div className="text-center py-16 border rounded-lg bg-card">
              <Plane className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
              <h3 className="text-lg font-medium">No flights match your filters</h3>
              <p className="text-muted-foreground text-sm mt-1">Try removing some filters.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredOffers.map((offer) => {
                const isRoundTrip = (offer.slices?.length ?? 0) > 1;
                const firstSlice = offer.slices?.[0];
                const allBaggages = (firstSlice?.segments ?? []).flatMap((s) => s.baggages ?? []);
                const checkedBag = allBaggages.find((b) => b.type === "checked");
                const carryOn = allBaggages.find((b) => b.type === "carry_on");
                const airlineCode = offer.owner?.iataCode ?? "";
                const airlineWebsite = airlineCode ? getAirlineWebsite(airlineCode) : null;

                const renderSliceRow = (slice: NonNullable<typeof offer.slices>[0], label?: string) => {
                  const segs = slice?.segments ?? [];
                  const first = segs[0];
                  const last = segs[segs.length - 1];
                  const depTime = first?.departureDateTime
                    ? new Date(first.departureDateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
                    : "--:--";
                  const arrTime = last?.arrivalDateTime
                    ? new Date(last.arrivalDateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
                    : "--:--";
                  const depDate = first?.departureDateTime ? formatShortDate(first.departureDateTime) : "";
                  const arrDate = last?.arrivalDateTime ? formatShortDate(last.arrivalDateTime) : "";
                  const stops = segs.length - 1;
                  return (
                    <div className="flex flex-col gap-1">
                      {label && (
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
                      )}
                      <div className="grid grid-cols-3 gap-2 text-center items-center">
                        <div>
                          <div className="text-lg md:text-xl font-bold tabular-nums">{depTime}</div>
                          <div className="text-sm font-semibold text-primary">{slice?.origin?.iataCode}</div>
                          <div className="text-xs text-muted-foreground">{depDate}</div>
                        </div>
                        <div className="flex flex-col items-center px-1">
                          <div className="text-xs text-muted-foreground mb-1">{slice?.duration ? formatDuration(slice.duration) : ""}</div>
                          <div className="w-full flex items-center">
                            <div className="h-px bg-border flex-1" />
                            <Plane className="h-3 w-3 text-muted-foreground mx-1 flex-shrink-0" />
                            <div className="h-px bg-border flex-1" />
                          </div>
                          <div className={`text-xs mt-1 font-medium ${stops === 0 ? "text-green-600" : "text-amber-600"}`}>
                            {stops === 0 ? "Non-stop" : `${stops} stop${stops > 1 ? "s" : ""}`}
                          </div>
                        </div>
                        <div>
                          <div className="text-lg md:text-xl font-bold tabular-nums">{arrTime}</div>
                          <div className="text-sm font-semibold text-primary">{slice?.destination?.iataCode}</div>
                          <div className="text-xs text-muted-foreground">{arrDate}</div>
                        </div>
                      </div>
                    </div>
                  );
                };

                return (
                  <Card key={offer.id} className="hover:border-primary/50 transition-colors">
                    <CardContent className="p-4 md:p-5">
                      <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between">

                        {/* Airline logo + name + website */}
                        <div className="flex flex-col items-center gap-1 flex-shrink-0 w-16">
                          {offer.owner?.logoSymbolUrl ? (
                            <img src={offer.owner.logoSymbolUrl} alt={offer.owner.name} className="w-10 h-10 object-contain" />
                          ) : (
                            <div className="w-10 h-10 bg-muted rounded flex items-center justify-center font-bold text-muted-foreground text-xs">
                              {airlineCode || "??"}
                            </div>
                          )}
                          <span className="text-xs text-muted-foreground text-center leading-tight line-clamp-2">{offer.owner?.name}</span>
                          {airlineWebsite && (
                            <a
                              href={airlineWebsite}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-0.5 text-[10px] text-primary hover:underline"
                            >
                              <ExternalLink className="h-2.5 w-2.5" />
                              Website
                            </a>
                          )}
                        </div>

                        {/* Route(s) — one or two slices */}
                        <div className="flex flex-col flex-1 gap-3 min-w-0">
                          {renderSliceRow(offer.slices![0], isRoundTrip ? "Outbound" : undefined)}
                          {isRoundTrip && offer.slices![1] && (
                            <>
                              <div className="border-t border-dashed border-border" />
                              {renderSliceRow(offer.slices![1], "Return")}
                            </>
                          )}
                        </div>

                        {/* Price + CTA */}
                        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 sm:gap-2 border-t sm:border-t-0 sm:border-l border-border pt-3 sm:pt-0 sm:pl-5 flex-shrink-0">
                          <div className="text-right">
                            <div className="text-xl md:text-2xl font-bold text-primary">
                              {formatCurrency(offer.totalAmount, offer.totalCurrency, displayCurrency)}
                            </div>
                            <div className="text-xs text-muted-foreground uppercase tracking-wide">
                              {offer.cabinClass?.replace("_", " ")}
                            </div>
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
                            onClick={() => {
                              try {
                                sessionStorage.setItem(`offer_${offer.id}`, JSON.stringify(offer));
                              } catch {}
                              setLocation(`/offers/${offer.id}`);
                            }}
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
          )}
        </div>
      )}

      {data && data.offers.length === 0 && (
        <div className="text-center py-16 border rounded-lg bg-card">
          <Plane className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
          <h3 className="text-lg font-medium">No flights found</h3>
          <p className="text-muted-foreground text-sm mt-1">Try different dates or airports.</p>
        </div>
      )}
    </div>
  );
}
