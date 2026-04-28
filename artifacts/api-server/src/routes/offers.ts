import { Router } from "express";
import { duffel } from "../lib/duffel";
import type { OfferAvailableServiceBaggage } from "@duffel/api";
import { SearchOffersBody } from "@workspace/api-zod";

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
  const seen = new Set<string>();
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
    })
    .filter((svc) => {
      const key = `${svc.type}-${svc.maximumWeightKg}-${svc.segmentIds.join(",")}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
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
      return {
        message: first.message || first.title || "Airline error",
        code,
        httpStatus,
      };
    }
  }
  if (err instanceof Error) {
    return { message: err.message, code: "server_error", httpStatus: 500 };
  }
  return { message: "Unknown error", code: "unknown", httpStatus: 500 };
}

const router = Router();

router.post("/offers/search", async (req, res) => {
  const parsed = SearchOffersBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "validation_error",
      message: parsed.error.message,
    });
    return;
  }

  const { origin, destination, departureDate, returnDate, passengers, cabinClass } =
    parsed.data;

  try {
    const slices: { origin: string; destination: string; departure_date: string }[] = [
      {
        origin,
        destination,
        departure_date: departureDate,
      },
    ];

    if (returnDate) {
      slices.push({
        origin: destination,
        destination: origin,
        departure_date: returnDate,
      });
    }

    const offerRequest = await duffel.offerRequests.create({
      slices,
      passengers: passengers.map((p) => ({
        type: p.type as "adult" | "child" | "infant_without_seat",
        ...(p.age !== undefined ? { age: p.age } : {}),
      })),
      cabin_class: (cabinClass ?? "economy") as
        | "economy"
        | "premium_economy"
        | "business"
        | "first",
      return_offers: false,
    });

    const offersList = await duffel.offers.list({
      offer_request_id: offerRequest.data.id,
      sort: "total_amount",
      limit: 50,
    });

    const offers = offersList.data.map((offer) => {
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
        slices: offer.slices.map((slice) => ({
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
          segments: slice.segments.map((seg) => ({
            id: seg.id,
            origin: {
              iataCode: seg.origin.iata_code,
              name: seg.origin.name,
              cityName: seg.origin.city_name,
              countryName: seg.origin.iata_country_code,
            },
            destination: {
              iataCode: seg.destination.iata_code,
              name: seg.destination.name,
              cityName: seg.destination.city_name,
              countryName: seg.destination.iata_country_code,
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
              ? {
                  iataCode: seg.aircraft.iata_code,
                  name: seg.aircraft.name,
                }
              : undefined,
            baggages: seg.passengers?.[0]?.baggages?.map((b) => ({
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
      };
    });

    res.json({
      offerRequestId: offerRequest.data.id,
      offers,
    });
  } catch (err: unknown) {
    req.log.error({ err }, "Error searching offers");
    const message =
      err instanceof Error ? err.message : "Failed to search offers";
    res.status(500).json({ error: "duffel_error", message });
  }
});

router.get("/offers/:offerId", async (req, res) => {
  const { offerId } = req.params;

  try {
    const { data: offer } = await duffel.offers.get(offerId);

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
      slices: offer.slices.map((slice) => ({
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
        segments: slice.segments.map((seg) => ({
          id: seg.id,
          origin: {
            iataCode: seg.origin.iata_code,
            name: seg.origin.name,
            cityName: seg.origin.city_name,
            countryName: seg.origin.iata_country_code,
          },
          destination: {
            iataCode: seg.destination.iata_code,
            name: seg.destination.name,
            cityName: seg.destination.city_name,
            countryName: seg.destination.iata_country_code,
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
            ? {
                iataCode: seg.aircraft.iata_code,
                name: seg.aircraft.name,
              }
            : undefined,
          baggages: seg.passengers?.[0]?.baggages?.map((b) => ({
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
