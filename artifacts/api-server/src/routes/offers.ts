import { Router } from "express";
import { duffel } from "../lib/duffel";
import { SearchOffersBody } from "@workspace/api-zod";

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

    const offers = offersList.data.map((offer) => ({
      id: offer.id,
      totalAmount: offer.total_amount,
      totalCurrency: offer.total_currency,
      baseAmount: offer.base_amount,
      taxAmount: offer.tax_amount,
      expiresAt: offer.expires_at,
      cabinClass: offer.cabin_class,
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
        })),
      })),
      passengers: offer.passengers,
      owner: {
        iataCode: offer.owner.iata_code,
        name: offer.owner.name,
        logoSymbolUrl: offer.owner.logo_symbol_url,
        logotypeLockupImageUrl: offer.owner.logotype_lockup_image_url,
      },
    }));

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

    res.json({
      id: offer.id,
      totalAmount: offer.total_amount,
      totalCurrency: offer.total_currency,
      baseAmount: offer.base_amount,
      taxAmount: offer.tax_amount,
      expiresAt: offer.expires_at,
      cabinClass: offer.cabin_class,
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
    const message =
      err instanceof Error ? err.message : "Offer not found";
    res.status(404).json({ error: "not_found", message });
  }
});

export default router;
