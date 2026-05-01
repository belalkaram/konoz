import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { authFetch, BASE } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

interface SearchKey {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  cabinClass: string;
  adults: number;
  tripType: string;
}

interface PriceData {
  date: string;
  dayNameAr: string;
  formattedDateAr: string;
  cheapestPrice: number | null;
  currency: string;
  available: boolean;
}

interface FlexibleDatePriceSliderProps {
  selectedDate: string;
  searchParams: SearchKey | null;
  onDateChange: (date: string) => void;
  displayCurrency: string;
}

function getFlexibleDateRange(selectedDate: string) {
  const dates = [];
  const base = new Date(selectedDate);
  for (let i = -3; i <= 3; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

const priceCache = new Map<string, PriceData>();

async function fetchCheapestPriceForDate(
  searchParams: SearchKey,
  date: string
): Promise<PriceData> {
  const cacheKey = JSON.stringify({ ...searchParams, departureDate: date });
  if (priceCache.has(cacheKey)) {
    return priceCache.get(cacheKey)!;
  }

  const dateObj = new Date(date);
  const dayNameAr = dateObj.toLocaleDateString("ar-EG", { weekday: "long" });
  const formattedDateAr = dateObj.toLocaleDateString("ar-EG", { day: "numeric", month: "long" });

  const body = {
    origin: searchParams.origin,
    destination: searchParams.destination,
    departureDate: date,
    passengers: Array.from({ length: searchParams.adults }).map(() => ({ type: "adult" })),
    cabinClass: searchParams.cabinClass,
    ...(searchParams.tripType === "round_trip" && searchParams.returnDate ? { returnDate: searchParams.returnDate } : {}),
  };

  try {
    const res = await authFetch(`${BASE}/api/offers/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error("Search failed");
    const data = await res.json();
    const offers = data.offers || [];

    if (offers.length === 0) {
      const result = { date, dayNameAr, formattedDateAr, cheapestPrice: null, currency: "USD", available: false };
      priceCache.set(cacheKey, result);
      return result;
    }

    const minPrice = Math.min(...offers.map((o: any) => parseFloat(o.totalAmount)));
    const currency = offers[0].totalCurrency;

    const result = { date, dayNameAr, formattedDateAr, cheapestPrice: minPrice, currency, available: true };
    priceCache.set(cacheKey, result);
    return result;
  } catch (err) {
    const result = { date, dayNameAr, formattedDateAr, cheapestPrice: null, currency: "USD", available: false };
    priceCache.set(cacheKey, result);
    return result;
  }
}

export function FlexibleDatePriceSlider({
  selectedDate,
  searchParams,
  onDateChange,
  displayCurrency,
}: FlexibleDatePriceSliderProps) {
  const [pricesByDate, setPricesByDate] = useState<Record<string, PriceData>>({});
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!searchParams) return;

    const dates = getFlexibleDateRange(selectedDate);
    
    dates.forEach((date) => {
      setLoadingStates((prev) => ({ ...prev, [date]: true }));
      fetchCheapestPriceForDate(searchParams, date).then((priceData) => {
        setPricesByDate((prev) => ({ ...prev, [date]: priceData }));
        setLoadingStates((prev) => ({ ...prev, [date]: false }));
      });
    });
  }, [selectedDate, searchParams]);

  const dates = getFlexibleDateRange(selectedDate);

  const scroll = (direction: "left" | "right") => {
    if (containerRef.current) {
      const scrollAmount = 200;
      containerRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  if (!searchParams) return null;

  return (
    <div className="relative mb-6 rounded-xl border border-border bg-card p-3 shadow-sm overflow-hidden" dir="rtl">
      <div className="flex items-center gap-2">
        <button
          onClick={() => scroll("right")}
          className="p-1.5 rounded-full hover:bg-accent text-muted-foreground flex-shrink-0 z-10 hidden sm:block"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        <div
          ref={containerRef}
          className="flex flex-1 items-center gap-2 overflow-x-auto scrollbar-hide snap-x px-1 py-1"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {dates.map((date) => {
            const isLoading = loadingStates[date];
            const data = pricesByDate[date];
            const isSelected = date === selectedDate;

            return (
              <button
                key={date}
                onClick={() => onDateChange(date)}
                className={`flex-shrink-0 w-32 sm:w-36 rounded-lg p-2.5 flex flex-col items-center justify-center gap-1.5 border transition-all snap-center
                  ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary"
                      : "border-border hover:border-primary/40 hover:bg-accent/50"
                  }
                `}
              >
                {isLoading ? (
                  <>
                    <Skeleton className="h-4 w-16 mb-1" />
                    <Skeleton className="h-3 w-20 mb-1" />
                    <Skeleton className="h-5 w-16" />
                  </>
                ) : (
                  <>
                    <div className="text-sm font-semibold whitespace-nowrap text-foreground">
                      {data?.dayNameAr}
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {data?.formattedDateAr}
                    </div>
                    <div className={`text-sm font-bold mt-0.5 ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                      {data?.available && data?.cheapestPrice !== null ? (
                        formatCurrency(data.cheapestPrice.toString(), data.currency, displayCurrency)
                      ) : (
                        <span className="text-xs font-normal text-muted-foreground">لا توجد عروض متاحة</span>
                      )}
                    </div>
                  </>
                )}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => scroll("left")}
          className="p-1.5 rounded-full hover:bg-accent text-muted-foreground flex-shrink-0 z-10 hidden sm:block"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
