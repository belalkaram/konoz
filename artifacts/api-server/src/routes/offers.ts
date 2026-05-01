import { Router } from "express";
import { duffel } from "../lib/duffel";
// import type { OfferAvailableServiceBaggage } from "@duffel/api";
type OfferAvailableServiceBaggage = any;
import { SearchOffersBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth.js";

function extractBaggageWeightMap(
  availableServices: { type: string; metadata?: unknown; segment_ids?: string[] }[]
): Map<string, Map<string, number | null>> {
  const map = new Map<string, Map<string, number | null>>();
  for (const service of availableServices) {
    if (service.type !== "baggage") continue;
    const svc = service as OfferAvailableServiceBaggage;
    const weightKg = svc.metadata?.maximum_weight_kg ?? null;
    const baggageType = svc.metadata?.type;
    if (!baggageType) continue;
    for (const segId of svc.segment_ids ?? []) {
      if (!map.has(segId)) map.set(segId, new Map());
      const inner = map.get(segId)!;
      if (!inner.has(baggageType)) inner.set(baggageType, weightKg);
    }
  }
  return map;
}

function mapAvailableBaggageServices(
  availableServices: { type: string; metadata?: unknown; segment_ids?: string[]; passenger_ids?: string[]; id?: string; total_amount?: string; total_currency?: string }[]
) {
  return availableServices
    .filter((s) => s.type === "baggage")
    .map((s) => {
      const svc = s as OfferAvailableServiceBaggage;
      return {
        id: svc.id,
        type: svc.metadata?.type ?? "checked",
        maximumWeightKg: svc.metadata?.maximum_weight_kg ?? null,
        maximumHeightCm: svc.metadata?.maximum_height_cm ?? null,
        maximumLengthCm: svc.metadata?.maximum_length_cm ?? null,
        maximumDepthCm: svc.metadata?.maximum_depth_cm ?? null,
        totalAmount: svc.total_amount,
        totalCurrency: svc.total_currency,
        segmentIds: svc.segment_ids ?? [],
        passengerIds: svc.passenger_ids ?? [],
      };
    });
}

function mapOffer(offer: any) {
  const weightMap = extractBaggageWeightMap(offer.available_services ?? []);
  return {
    id: offer.id,
    totalAmount: offer.total_amount,
    totalCurrency: offer.total_currency,
    baseAmount: offer.base_amount,
    taxAmount: offer.tax_amount,
    expiresAt: offer.expires_at,
    cabinClass: offer.cabin_class,
    availableBaggageServices: mapAvailableBaggageServices(offer.available_services ?? []),
    slices: offer.slices.map((slice: any) => ({
      id: slice.id,
      origin: {
        iataCode: slice.origin.iata_code,
        name: slice.origin.name,
        cityName: slice.origin.city_name,
        countryName: slice.origin.iata_country_code,
      },
      destination: {
        iataCode: slice.destination.iata_code,
        name: slice.destination.name,
        cityName: slice.destination.city_name,
        countryName: slice.destination.iata_country_code,
      },
      departureDateTime: slice.segments[0]?.departing_at ?? "",
      arrivalDateTime: slice.segments[slice.segments.length - 1]?.arriving_at ?? "",
      duration: slice.duration,
      fareBrandName: slice.fare_brand_name,
      segments: slice.segments.map((seg: any) => ({
        id: seg.id,
        origin: {
          iataCode: seg.origin.iata_code,
          name: seg.origin.name,
          cityName: seg.origin.city_name,
          countryName: seg.origin.iata_country_code,
          terminal: seg.origin_terminal,
        },
        destination: {
          iataCode: seg.destination.iata_code,
          name: seg.destination.name,
          cityName: seg.destination.city_name,
          countryName: seg.destination.iata_country_code,
          terminal: seg.destination_terminal,
        },
        departureDateTime: seg.departing_at,
        arrivalDateTime: seg.arriving_at,
        duration: seg.duration,
        flightNumber: `${seg.marketing_carrier.iata_code}${seg.marketing_carrier_flight_number}`,
        marketingCarrier: {
          iataCode: seg.marketing_carrier.iata_code,
          name: seg.marketing_carrier.name,
          logoSymbolUrl: seg.marketing_carrier.logo_symbol_url,
          logotypeLockupImageUrl: seg.marketing_carrier.logotype_lockup_image_url,
        },
        operatingCarrier: {
          iataCode: seg.operating_carrier.iata_code,
          name: seg.operating_carrier.name,
          logoSymbolUrl: seg.operating_carrier.logo_symbol_url,
          logotypeLockupImageUrl: seg.operating_carrier.logotype_lockup_image_url,
        },
        aircraft: seg.aircraft
          ? { iataCode: seg.aircraft.iata_code, name: seg.aircraft.name }
          : undefined,
        baggages: seg.passengers?.[0]?.baggages?.map((b: any) => ({
          type: b.type as "carry_on" | "checked",
          quantity: b.quantity,
          maximumWeightKg: weightMap.get(seg.id)?.get(b.type) ?? null,
        })) ?? [],
      })),
    })),
    passengers: offer.passengers,
    conditions: offer.conditions,
    owner: {
      iataCode: offer.owner.iata_code,
      name: offer.owner.name,
      logoSymbolUrl: offer.owner.logo_symbol_url,
      logotypeLockupImageUrl: offer.owner.logotype_lockup_image_url,
    },
  };
}

function getFlightGroupKey(offer: ReturnType<typeof mapOffer>) {
  const slicesKey = offer.slices
    .map((slice: any) =>
      slice.segments
        .map((seg: any) => `${seg.marketingCarrier.iataCode}${seg.flightNumber}-${seg.departureDateTime}`)
        .join("|")
    )
    .join("||");
  return `${offer.owner.iataCode}-${slicesKey}`;
}

function groupOffers(offers: ReturnType<typeof mapOffer>[]) {
  const groups = new Map<string, ReturnType<typeof mapOffer>[]>();
  for (const offer of offers) {
    const key = getFlightGroupKey(offer);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(offer);
  }

  const result = [];
  for (const group of groups.values()) {
    group.sort((a, b) => parseFloat(a.totalAmount) - parseFloat(b.totalAmount));
    const cheapest = group[0];

    const packageNames = ["Basic", "Comfort", "Flex", "Flex Plus", "Business"];

    const farePackages = group.map((offer, index) => {
      let name = offer.slices[0]?.fareBrandName || "Basic";
      if (!offer.slices[0]?.fareBrandName) {
        if (offer.cabinClass === "business") {
          name = "Business";
        } else if (offer.cabinClass === "first") {
          name = "First";
        } else if (offer.cabinClass === "premium_economy") {
          name = "Premium";
        } else {
          name = packageNames[Math.min(index, 3)];
        }
      }

      const diff = parseFloat(offer.totalAmount) - parseFloat(cheapest.totalAmount);
      
      const refundable = offer.conditions?.refund_before_departure?.allowed ?? false;
      const changeable = offer.conditions?.change_before_departure?.allowed ?? false;

      return {
        id: offer.id,
        name,
        cabin: offer.cabinClass,
        price: parseFloat(offer.totalAmount),
        priceDifference: diff,
        currency: offer.totalCurrency,
        baggage: offer.availableBaggageServices || [],
        refundable,
        changeable,
        sourceOfferId: offer.id,
        available: true,
      };
    });

    result.push({
      ...cheapest,
      basePrice: parseFloat(cheapest.totalAmount),
      currency: cheapest.totalCurrency,
      farePackages,
    });
  }

  result.sort((a, b) => parseFloat(a.totalAmount) - parseFloat(b.totalAmount));
  return result;
}

function extractDuffelError(err: unknown): { message: string; code: string; httpStatus: number } {
  if (err && typeof err === "object") {
    const duffelErr = err as {
      errors?: Array<{ code?: string; title?: string; message?: string; type?: string }>;
      meta?: { status?: number };
    };
    if (Array.isArray(duffelErr.errors) && duffelErr.errors.length > 0) {
      const first = duffelErr.errors[0];
      const apiStatus = duffelErr.meta?.status ?? 500;
      let httpStatus = 500;
      const code = first.code ?? first.type ?? "unknown";
      if (
        apiStatus === 404 ||
        code === "offer_no_longer_available" ||
        code === "not_found" ||
        code === "offer_expired"
      ) {
        httpStatus = 404;
      } else if (first.type === "airline_error" || apiStatus >= 500) {
        httpStatus = 502;
      } else if (apiStatus >= 400) {
        httpStatus = apiStatus;
      }
      return { message: first.message || first.title || "Airline error", code, httpStatus };
    }
  }
  if (err instanceof Error) return { message: "An unexpected error occurred", code: "server_error", httpStatus: 500 };
  return { message: "An unexpected error occurred", code: "unknown", httpStatus: 500 };
}

const router = Router();

router.post("/offers/search", requireAuth, async (req, res) => {
  const body = req.body as Record<string, unknown>;

  try {
    let offerRequestId: string;

    if (typeof body.offerRequestId === "string") {
      offerRequestId = body.offerRequestId;
    } else {
      const parsed = SearchOffersBody.safeParse(body);
      if (!parsed.success) {
        res.status(400).json({ error: "validation_error", message: parsed.error.message });
        return;
      }

      const { origin, destination, departureDate, returnDate, passengers, cabinClass } = parsed.data;

      const slices: { origin: string; destination: string; departure_date: string }[] = [
        { origin, destination, departure_date: (departureDate as Date).toISOString().split("T")[0] },
      ];
      if (returnDate) {
        slices.push({ origin: destination, destination: origin, departure_date: (returnDate as Date).toISOString().split("T")[0] });
      }

      const offerRequest = await duffel.offerRequests.create({
        slices: slices as any,
        passengers: passengers.map((p: any) => ({
          type: p.type as any,
          ...(p.age !== undefined ? { age: p.age } : {}),
        }) as any),
        cabin_class: (cabinClass ?? "economy") as "economy" | "premium_economy" | "business" | "first",
        return_offers: false,
      });

      offerRequestId = offerRequest.data.id;
    }

    const after = typeof body.after === "string" ? body.after : undefined;

    const offersList = await duffel.offers.list({
      offer_request_id: offerRequestId,
      sort: "total_amount",
      limit: 200,
      ...(after ? { after } : {}),
    });

    const rawOffers = offersList.data.map(mapOffer);
    const offers = groupOffers(rawOffers);
    const nextAfter = offersList.meta?.after ?? null;

    res.json({ offerRequestId, offers, nextAfter });
  } catch (err: unknown) {
    req.log.error({ err }, "Error searching offers");
    const { message, code, httpStatus } = extractDuffelError(err);
    res.status(httpStatus).json({ error: code, message });
  }
});

router.get("/offers/:offerId", requireAuth, async (req, res) => {
  const { offerId } = req.params;

  try {
    const { data: offer } = await duffel.offers.get(offerId as string) as any;

    const weightMap = extractBaggageWeightMap(offer.available_services ?? []);
    res.json({
      id: offer.id,
      totalAmount: offer.total_amount,
      totalCurrency: offer.total_currency,
      baseAmount: offer.base_amount,
      taxAmount: offer.tax_amount,
      expiresAt: offer.expires_at,
      cabinClass: offer.cabin_class,
      availableBaggageServices: mapAvailableBaggageServices(offer.available_services ?? []),
      slices: offer.slices.map((slice: any) => ({
        id: slice.id,
        origin: {
          iataCode: slice.origin.iata_code,
          name: slice.origin.name,
          cityName: slice.origin.city_name,
          countryName: slice.origin.iata_country_code,
        },
        destination: {
          iataCode: slice.destination.iata_code,
          name: slice.destination.name,
          cityName: slice.destination.city_name,
          countryName: slice.destination.iata_country_code,
        },
        departureDateTime: slice.segments[0]?.departing_at ?? "",
        arrivalDateTime: slice.segments[slice.segments.length - 1]?.arriving_at ?? "",
        duration: slice.duration,
        segments: slice.segments.map((seg: any) => ({
          id: seg.id,
          origin: {
            iataCode: seg.origin.iata_code,
            name: seg.origin.name,
            cityName: seg.origin.city_name,
            countryName: seg.origin.iata_country_code,
            terminal: seg.origin_terminal,
          },
          destination: {
            iataCode: seg.destination.iata_code,
            name: seg.destination.name,
            cityName: seg.destination.city_name,
            countryName: seg.destination.iata_country_code,
            terminal: seg.destination_terminal,
          },
          departureDateTime: seg.departing_at,
          arrivalDateTime: seg.arriving_at,
          duration: seg.duration,
          flightNumber: `${seg.marketing_carrier.iata_code}${seg.marketing_carrier_flight_number}`,
          marketingCarrier: {
            iataCode: seg.marketing_carrier.iata_code,
            name: seg.marketing_carrier.name,
            logoSymbolUrl: seg.marketing_carrier.logo_symbol_url,
            logotypeLockupImageUrl: seg.marketing_carrier.logotype_lockup_image_url,
          },
          operatingCarrier: {
            iataCode: seg.operating_carrier.iata_code,
            name: seg.operating_carrier.name,
            logoSymbolUrl: seg.operating_carrier.logo_symbol_url,
            logotypeLockupImageUrl: seg.operating_carrier.logotype_lockup_image_url,
          },
          aircraft: seg.aircraft
            ? { iataCode: seg.aircraft.iata_code, name: seg.aircraft.name }
            : undefined,
          baggages: seg.passengers?.[0]?.baggages?.map((b: any) => ({
            type: b.type as "carry_on" | "checked",
            quantity: b.quantity,
            maximumWeightKg: weightMap.get(seg.id)?.get(b.type) ?? null,
          })) ?? [],
        })),
      })),
      passengers: offer.passengers,
      owner: {
        iataCode: offer.owner.iata_code,
        name: offer.owner.name,
        logoSymbolUrl: offer.owner.logo_symbol_url,
        logotypeLockupImageUrl: offer.owner.logotype_lockup_image_url,
      },
    });
  } catch (err: unknown) {
    req.log.error({ err }, "Error getting offer");
    const { message, code, httpStatus } = extractDuffelError(err);
    res.status(httpStatus).json({ error: code, message });
  }
});

export default router;
