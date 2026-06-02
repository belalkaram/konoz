import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { authFetch, BASE } from "@/lib/api";
import { useLanguage } from "@/contexts/language-context";

interface Airport {
  iataCode: string;
  name: string;
  cityName: string;
  countryName: string;
}

interface AirportComboboxProps {
  id: string;
  label: string;
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
}

async function searchAirports(query: string): Promise<Airport[]> {
  if (query.length < 1) return [];
  const res = await authFetch(`${BASE}/api/airports/search?query=${encodeURIComponent(query)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.airports ?? [];
}

export function AirportCombobox({ id, label, value, onChange, placeholder }: AirportComboboxProps) {
  const [inputValue, setInputValue] = useState(value);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { language, isRtl } = useLanguage();

  const { data: airports = [], isFetching } = useQuery({
    queryKey: ["airports", query],
    queryFn: () => searchAirports(query),
    enabled: query.length >= 1,
    staleTime: 60_000,
  });

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.toUpperCase();
    setInputValue(val);
    setQuery(val);
    setOpen(true);
    setHighlighted(0);
    if (val.length === 0) onChange("");
  }

  function selectAirport(airport: Airport) {
    setInputValue(`${airport.iataCode} – ${airport.cityName || airport.name}`);
    onChange(airport.iataCode);
    setOpen(false);
    setQuery("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || airports.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, airports.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (airports[highlighted]) selectAirport(airports[highlighted]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  function handleFocus() {
    if (query.length >= 1) setOpen(true);
  }

  const showDropdown = open && query.length >= 1;

  return (
    <div className="space-y-2 relative" ref={containerRef}>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          ref={inputRef}
          id={id}
          value={inputValue}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder={placeholder ?? (language === "ar" ? "مثال: CAI أو القاهرة" : "e.g. LHR or London")}
          autoComplete="off"
          className="pr-8 rtl:pr-3 rtl:pl-8 text-start"
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground rtl:right-auto rtl:left-2.5">
          {isFetching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MapPin className="h-4 w-4" />
          )}
        </div>
      </div>

      {showDropdown && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-popover-border rounded-md shadow-lg overflow-hidden">
          {airports.length === 0 && !isFetching && (
            <div className="px-4 py-3 text-sm text-muted-foreground text-start">
              {language === "ar" ? "لم يتم العثور على مطارات" : "No airports found"}
            </div>
          )}
          {airports.map((airport, i) => (
            <button
              key={airport.iataCode}
              type="button"
              className={cn(
                "w-full px-4 py-2.5 text-sm flex items-start gap-3 transition-colors text-start rtl:flex-row-reverse",
                i === highlighted
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50"
              )}
              onMouseEnter={() => setHighlighted(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                selectAirport(airport);
              }}
            >
              <span className="font-bold text-primary mt-0.5 w-10 flex-shrink-0 text-base text-start rtl:text-end">
                {airport.iataCode}
              </span>
              <span className="flex-1 flex flex-col min-w-0 text-start">
                <span className="font-medium truncate">{airport.cityName || airport.name}</span>
                <span className="text-muted-foreground text-xs truncate">{airport.name}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
