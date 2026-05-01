import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import type { PassengerInputType, SearchOffersBodyCabinClass } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDuration, formatShortDate, formatTime } from "@/lib/formatters";
import { getAirlineWebsite } from "@/lib/airlines";
import {
  Plane, Search as SearchIcon, ArrowRight, Clock, Users, ArrowLeftRight,
  Luggage, ShoppingBag, ExternalLink, Filter, RotateCcw, ChevronDown, ChevronUp, Info,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AirportCombobox } from "@/components/airport-combobox";
import { Input } from "@/components/ui/input";
import { authFetch, BASE } from "@/lib/api";
import { FlexibleDatePriceSlider } from "@/components/flexible-date-price-slider";
import { FarePackageCards } from "@/components/fare-package-cards";

type TripType = "one_way" | "round_trip";
type StopsFilter = "all" | "nonstop" | "stops";
type DisplayCurrency = "USD" | "EGP" | "KWD" | "SAR";

const CURRENCY_LABELS: Record<DisplayCurrency, string> = {
  USD: "$ USD",
  EGP: "EGP £",
  KWD: "KD KWD",
  SAR: "SR SAR",
};

interface BaggageService {
  id: string;
  type: string;
  maximumWeightKg: number | null;
  totalAmount: string;
  totalCurrency: string;
  segmentIds: string[];
  passengerIds: string[];
}

interface Baggage {
  type: "carry_on" | "checked";
  quantity: number;
  maximumWeightKg: number | null;
}

interface Carrier {
  iataCode: string;
  name: string;
  logoSymbolUrl?: string | null;
  logotypeLockupImageUrl?: string | null;
}

interface Airport {
  iataCode: string;
  name: string;
  cityName?: string | null;
  countryName?: string | null;
}

interface Segment {
  id: string;
  origin: Airport;
  destination: Airport;
  departureDateTime: string;
  arrivalDateTime: string;
  duration?: string | null;
  flightNumber: string;
  marketingCarrier: Carrier;
  operatingCarrier: Carrier;
  baggages: Baggage[];
}

interface Slice {
  id: string;
  origin: Airport;
  destination: Airport;
  departureDateTime: string;
  arrivalDateTime: string;
  duration?: string | null;
  segments: Segment[];
}

interface Offer {
  id: string;
  totalAmount: string;
  totalCurrency: string;
  baseAmount?: string | null;
  taxAmount?: string | null;
  expiresAt?: string | null;
  cabinClass?: string | null;
  availableBaggageServices: BaggageService[];
  slices: Slice[];
  owner: Carrier;
  farePackages?: any[];
}

interface SearchResult {
  offerRequestId: string;
  offers: Offer[];
  nextAfter: string | null;
}

interface SearchKey {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  cabinClass: SearchOffersBodyCabinClass;
  adults: number;
  tripType: TripType;
}

async function fetchOffersPage(
  key: SearchKey,
  offerRequestId?: string | null,
  after?: string | null
): Promise<SearchResult> {
  const body: Record<string, unknown> = offerRequestId
    ? { offerRequestId, ...(after ? { after } : {}) }
    : {
        origin: key.origin,
        destination: key.destination,
        departureDate: key.departureDate,
        passengers: Array.from({ length: key.adults }).map(() => ({
          type: "adult" as PassengerInputType,
        })),
        cabinClass: key.cabinClass,
        ...(key.tripType === "round_trip" && key.returnDate
          ? { returnDate: key.returnDate }
          : {}),
      };

  const res = await authFetch(`${BASE}/api/offers/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Search failed" }));
    throw new Error((err as { message?: string }).message || "Search failed");
  }
  return res.json();
}

const addDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
};

function BaggagePackages({ services, currency }: { services: BaggageService[]; currency: string }) {
  const [open, setOpen] = useState(false);
  if (services.length === 0) return null;

  const uniqueServices = useMemo(() => {
    const seen = new Set<string>();
    return services.filter((s) => {
      const key = `${s.type}-${s.maximumWeightKg}-${s.totalAmount}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [services]);

  if (uniqueServices.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-xs text-primary hover:underline font-medium"
      >
        <Luggage className="h-3 w-3" />
        {uniqueServices.length} baggage add-on{uniqueServices.length !== 1 ? "s" : ""} available
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {open && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {uniqueServices.map((svc) => (
            <div
              key={svc.id}
              className="flex items-center gap-1 border border-border rounded-md px-2 py-1 text-xs bg-muted/30"
            >
              <Luggage className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <span>
                +1 {svc.type === "carry_on" ? "carry-on" : "checked"}
                {svc.maximumWeightKg ? ` · ${svc.maximumWeightKg}kg` : ""}
              </span>
              <span className="font-semibold text-primary ml-1">
                +{formatCurrency(svc.totalAmount, svc.totalCurrency)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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

  const [stopsFilter, setStopsFilter] = useState<StopsFilter>("all");
  const [selectedAirlines, setSelectedAirlines] = useState<Set<string>>(new Set());

  const [allOffers, setAllOffers] = useState<Offer[]>([]);
  const [offerRequestId, setOfferRequestId] = useState<string | null>(null);
  const [nextAfter, setNextAfter] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const currentSearchKey = useRef<SearchKey | null>(null);

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
      const key: SearchKey = {
        origin: from,
        destination: to,
        departureDate: date,
        returnDate: ret ?? undefined,
        cabinClass: cabin,
        adults: adultsCount,
        tripType: trip,
      };
      runSearch(key);
    }
  }, []);

  const runSearch = useCallback(async (key: SearchKey) => {
    currentSearchKey.current = key;
    setIsLoading(true);
    setSearchError(null);
    setAllOffers([]);
    setOfferRequestId(null);
    setNextAfter(null);
    setHasSearched(true);
    setSelectedAirlines(new Set());
    setStopsFilter("all");

    try {
      const result = await fetchOffersPage(key);
      if (currentSearchKey.current !== key) return;
      setAllOffers(result.offers);
      setOfferRequestId(result.offerRequestId);
      setNextAfter(result.nextAfter);
    } catch (err) {
      if (currentSearchKey.current !== key) return;
      setSearchError(err instanceof Error ? err.message : "Search failed");
    } finally {
      if (currentSearchKey.current === key) setIsLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!offerRequestId || !nextAfter || !currentSearchKey.current) return;
    setIsLoadingMore(true);
    try {
      const result = await fetchOffersPage(currentSearchKey.current, offerRequestId, nextAfter);
      setAllOffers((prev) => [...prev, ...result.offers]);
      setNextAfter(result.nextAfter);
    } catch (err) {
      toast({
        title: "Failed to load more",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingMore(false);
    }
  }, [offerRequestId, nextAfter, toast]);

  const availableAirlines = useMemo(() => {
    const map = new Map<string, { name: string; logo?: string | null }>();
    for (const offer of allOffers) {
      const code = offer.owner?.iataCode;
      if (code && !map.has(code)) {
        map.set(code, { name: offer.owner?.name ?? code, logo: offer.owner?.logoSymbolUrl });
      }
    }
    return Array.from(map.entries()).map(([code, info]) => ({ code, ...info }));
  }, [allOffers]);

  const filteredOffers = useMemo(() => {
    return allOffers.filter((offer) => {
      const slice = offer.slices?.[0];
      const segCount = slice?.segments?.length ?? 1;
      if (stopsFilter === "nonstop" && segCount !== 1) return false;
      if (stopsFilter === "stops" && segCount === 1) return false;
      if (selectedAirlines.size > 0 && offer.owner?.iataCode) {
        if (!selectedAirlines.has(offer.owner.iataCode)) return false;
      }
      return true;
    });
  }, [allOffers, stopsFilter, selectedAirlines]);

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
    const key: SearchKey = {
      origin,
      destination,
      departureDate,
      returnDate: tripType === "round_trip" ? returnDate : undefined,
      cabinClass,
      adults,
      tripType,
    };
    let url = `/search?from=${origin}&to=${destination}&date=${departureDate}&cabin=${cabinClass}&adults=${adults}&trip=${tripType}`;
    if (tripType === "round_trip" && returnDate) url += `&return=${returnDate}`;
    setLocation(url);
    runSearch(key);
  };

  const renderSliceRow = (slice: Slice, label?: string) => {
    const segs = slice?.segments ?? [];
    const first = segs[0];
    const last = segs[segs.length - 1];
    const depTime = formatTime(first?.departureDateTime);
    const arrTime = formatTime(last?.arrivalDateTime);
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

            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="flex-1">
                <AirportCombobox id="origin" label="From" value={origin} onChange={setOrigin} placeholder="City or IATA code" />
              </div>
              <button
                type="button"
                onClick={swapAirports}
                className="self-center sm:self-auto p-2 rounded-full border border-border hover:bg-accent text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                title="Swap airports"
              >
                <ArrowLeftRight className="h-4 w-4" />
              </button>
              <div className="flex-1">
                <AirportCombobox id="destination" label="To" value={destination} onChange={setDestination} placeholder="City or IATA code" />
              </div>
            </div>

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

      {/* Direct-booking airlines notice */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-3 py-2.5 flex gap-2.5 text-sm">
        <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="font-medium text-amber-800 dark:text-amber-300 text-xs leading-snug">
            بعض الشركات لا تظهر في البحث — احجز مباشرة من موقعها:
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
            {[
              { name: "Jazeera", code: "J9", url: "https://www.jazeeraairways.com" },
              { name: "Air Cairo", code: "SM", url: "https://www.aircairo.com" },
              { name: "Nile Air", code: "NP", url: "https://www.nileair.com" },
              { name: "flyadeal", code: "F3", url: "https://www.flyadeal.com" },
              { name: "Air Arabia EG", code: "E5", url: "https://www.airarabia.com/en/air-arabia-egypt" },
            ].map((a) => (
              <a
                key={a.code}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-300 underline underline-offset-2 hover:text-amber-900"
              >
                {a.name}
                <ExternalLink className="h-2.5 w-2.5 flex-shrink-0" />
              </a>
            ))}
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-3 sm:p-5">
                {/* Mobile skeleton */}
                <div className="sm:hidden space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><Skeleton className="w-7 h-7 rounded" /><Skeleton className="h-4 w-24" /></div>
                    <Skeleton className="h-5 w-16" />
                  </div>
                  <Skeleton className="h-16 w-full rounded-lg" />
                  <div className="flex justify-between"><Skeleton className="h-6 w-24" /><Skeleton className="h-8 w-20" /></div>
                </div>
                {/* Desktop skeleton */}
                <div className="hidden sm:flex justify-between items-center gap-4">
                  <Skeleton className="w-10 h-10 rounded flex-shrink-0" />
                  <div className="flex-1 space-y-2"><Skeleton className="h-5 w-36" /><Skeleton className="h-4 w-24" /></div>
                  <Skeleton className="h-10 w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {searchError && !isLoading && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="p-5 text-destructive flex items-start gap-3">
            <span className="font-medium">Search failed:</span>
            <span>{searchError}</span>
          </CardContent>
        </Card>
      )}

      {!isLoading && !searchError && hasSearched && allOffers.length === 0 && (
        <div className="text-center py-16 border rounded-lg bg-card">
          <Plane className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
          <h3 className="text-lg font-medium">No flights found</h3>
          <p className="text-muted-foreground text-sm mt-1">Try different dates or airports.</p>
        </div>
      )}

      {allOffers.length > 0 && !isLoading && (
        <div className="space-y-4">
          <FlexibleDatePriceSlider
            selectedDate={departureDate}
            searchParams={currentSearchKey.current}
            onDateChange={(newDate) => {
              setDepartureDate(newDate);
              const url = new URL(window.location.href);
              url.searchParams.set("date", newDate);
              setLocation(url.pathname + url.search);
              if (currentSearchKey.current) {
                runSearch({ ...currentSearchKey.current, departureDate: newDate });
              }
            }}
            displayCurrency={displayCurrency}
          />

          {/* Filters bar */}
          <div className="flex flex-wrap gap-3 items-start">
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

            {availableAirlines.length > 1 && (
              <div className="flex flex-wrap gap-1.5 items-center">
                <Filter className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                {availableAirlines.map(({ code, name, logo }) => (
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
                ))}
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
              {filteredOffers.length} of {allOffers.length} flights shown
              {nextAfter ? " — more available" : ""}
              {currentSearchKey.current?.tripType === "round_trip" ? " · Round trip" : " · One way"}
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

                const selectOffer = () => {
                  try { sessionStorage.setItem(`offer_${offer.id}`, JSON.stringify(offer)); } catch {}
                  setLocation(`/offers/${offer.id}`);
                };
                
                const selectPackage = (packageId: string) => {
                  setLocation(`/offers/${packageId}`);
                };

                const baggageBadges = (
                  <div className="flex gap-1 flex-wrap">
                    {checkedBag && checkedBag.quantity > 0 ? (
                      <Badge variant="secondary" className="text-xs gap-1 px-1.5 py-0.5">
                        <Luggage className="h-3 w-3" />
                        {checkedBag.quantity}✕ checked{checkedBag.maximumWeightKg ? ` · ${checkedBag.maximumWeightKg}kg` : ""}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs gap-1 px-1.5 py-0.5 text-muted-foreground">
                        <Luggage className="h-3 w-3" />
                        No bag
                      </Badge>
                    )}
                    {carryOn && carryOn.quantity > 0 && (
                      <Badge variant="secondary" className="text-xs gap-1 px-1.5 py-0.5">
                        <ShoppingBag className="h-3 w-3" />
                        {carryOn.quantity}✕ carry-on
                      </Badge>
                    )}
                  </div>
                );

                return (
                  <Card key={offer.id} className="hover:border-primary/50 transition-colors">
                    <CardContent className="p-3 sm:p-5">

                      {/* ── MOBILE LAYOUT ── */}
                      <div className="sm:hidden space-y-2.5">
                        {/* Top row: airline + price */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {offer.owner?.logoSymbolUrl ? (
                              <img src={offer.owner.logoSymbolUrl} alt={offer.owner.name} className="w-7 h-7 object-contain flex-shrink-0" />
                            ) : (
                              <div className="w-7 h-7 bg-muted rounded flex items-center justify-center font-bold text-muted-foreground text-[10px] flex-shrink-0">
                                {airlineCode || "??"}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="text-xs font-semibold truncate">{offer.owner?.name}</div>
                              <div className="text-[10px] text-muted-foreground uppercase">{offer.cabinClass?.replace("_", " ")}</div>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-lg font-bold text-primary leading-none">
                              {formatCurrency(offer.totalAmount, offer.totalCurrency, displayCurrency)}
                            </div>
                          </div>
                        </div>

                        {/* Route */}
                        <div className="bg-muted/30 rounded-lg px-3 py-2">
                          {renderSliceRow(offer.slices![0], isRoundTrip ? "Outbound" : undefined)}
                          {isRoundTrip && offer.slices![1] && (
                            <>
                              <div className="border-t border-dashed border-border my-2" />
                              {renderSliceRow(offer.slices![1], "Return")}
                            </>
                          )}
                        </div>

                        {/* Bottom row: baggage + select */}
                        <div className="flex items-center justify-between gap-2">
                          {baggageBadges}
                          <Button size="sm" className="flex-shrink-0 h-8 px-4 text-xs" onClick={selectOffer}>
                            Select <ArrowRight className="h-3.5 w-3.5 ml-1" />
                          </Button>
                        </div>

                        {airlineWebsite && (
                          <a href={airlineWebsite} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-0.5 text-[10px] text-primary hover:underline">
                            <ExternalLink className="h-2.5 w-2.5" /> Website
                          </a>
                        )}
                      </div>

                      {/* ── DESKTOP LAYOUT ── */}
                      <div className="hidden sm:flex gap-4 items-center justify-between">
                        {/* Airline logo + name */}
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
                            <a href={airlineWebsite} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-0.5 text-[10px] text-primary hover:underline">
                              <ExternalLink className="h-2.5 w-2.5" /> Website
                            </a>
                          )}
                        </div>

                        {/* Route(s) */}
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
                        <div className="flex flex-col items-end justify-center gap-2 border-l border-border pl-5 flex-shrink-0">
                          <div className="text-right">
                            <div className="text-2xl font-bold text-primary">
                              {formatCurrency(offer.totalAmount, offer.totalCurrency, displayCurrency)}
                            </div>
                            <div className="text-xs text-muted-foreground uppercase tracking-wide">
                              {offer.cabinClass?.replace("_", " ")}
                            </div>
                            <div className="mt-1">{baggageBadges}</div>
                          </div>
                          <Button size="sm" className="w-full" onClick={selectOffer}>
                            Select <ArrowRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      </div>

                      {/* Purchasable baggage packages */}
                      {offer.availableBaggageServices && offer.availableBaggageServices.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border/60">
                          <BaggagePackages services={offer.availableBaggageServices} currency={offer.totalCurrency} />
                        </div>
                      )}

                      {/* Fare Packages */}
                      {offer.farePackages && (
                        <FarePackageCards 
                          packages={offer.farePackages} 
                          displayCurrency={displayCurrency} 
                          onSelect={selectPackage} 
                        />
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Load More */}
          {nextAfter && (
            <div className="flex flex-col items-center gap-2 pt-2">
              <p className="text-sm text-muted-foreground">
                Showing {allOffers.length} flights — more results available
              </p>
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={isLoadingMore}
                className="min-w-40"
              >
                {isLoadingMore ? (
                  <span className="flex items-center gap-2">
                    <SearchIcon className="h-4 w-4 animate-spin" /> Loading...
                  </span>
                ) : (
                  "Load more flights"
                )}
              </Button>
            </div>
          )}

          {!nextAfter && allOffers.length > 0 && (
            <p className="text-center text-xs text-muted-foreground pt-2">
              All {allOffers.length} available flights shown
            </p>
          )}
        </div>
      )}
    </div>
  );
}
