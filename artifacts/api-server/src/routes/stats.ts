import { Router } from "express";
import { duffel } from "../lib/duffel";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

function formatOrder(order: Record<string, unknown>) {
  const o = order as {
    id: string;
    booking_reference: string;
    payment_status: {
      awaiting_payment: boolean;
      payment_required_by: string | null;
    };
    total_amount: string;
    total_currency: string;
    created_at: string;
    passengers: unknown[];
    slices: Array<{
      id: string;
      origin: { iata_code: string; name: string; city_name: string; iata_country_code: string };
      destination: { iata_code: string; name: string; city_name: string; iata_country_code: string };
      duration: string;
      segments: Array<{
        id: string;
        origin: { iata_code: string; name: string; city_name: string; iata_country_code: string };
        destination: { iata_code: string; name: string; city_name: string; iata_country_code: string };
        departing_at: string;
        arriving_at: string;
        duration: string;
        marketing_carrier: { iata_code: string; name: string; logo_symbol_url: string | null; logotype_lockup_image_url: string | null };
        marketing_carrier_flight_number: string;
        operating_carrier: { iata_code: string; name: string; logo_symbol_url: string | null; logotype_lockup_image_url: string | null };
        aircraft: { iata_code: string; name: string } | null;
      }>;
    }>;
    owner: { iata_code: string; name: string; logo_symbol_url: string | null; logotype_lockup_image_url: string | null };
    documents: unknown[];
  };

  return {
    id: o.id,
    bookingReference: o.booking_reference,
    status: o.payment_status.awaiting_payment ? "awaiting_payment" : "confirmed",
    totalAmount: o.total_amount,
    totalCurrency: o.total_currency,
    createdAt: o.created_at,
    passengers: o.passengers,
    slices: o.slices.map((slice) => ({
      id: slice.id,
      origin: { iataCode: slice.origin.iata_code, name: slice.origin.name, cityName: slice.origin.city_name, countryName: slice.origin.iata_country_code },
      destination: { iataCode: slice.destination.iata_code, name: slice.destination.name, cityName: slice.destination.city_name, countryName: slice.destination.iata_country_code },
      departureDateTime: slice.segments[0]?.departing_at ?? "",
      arrivalDateTime: slice.segments[slice.segments.length - 1]?.arriving_at ?? "",
      duration: slice.duration,
      segments: slice.segments.map((seg) => ({
        id: seg.id,
        origin: { iataCode: seg.origin.iata_code, name: seg.origin.name, cityName: seg.origin.city_name, countryName: seg.origin.iata_country_code },
        destination: { iataCode: seg.destination.iata_code, name: seg.destination.name, cityName: seg.destination.city_name, countryName: seg.destination.iata_country_code },
        departureDateTime: seg.departing_at,
        arrivalDateTime: seg.arriving_at,
        duration: seg.duration,
        flightNumber: `${seg.marketing_carrier.iata_code}${seg.marketing_carrier_flight_number}`,
        marketingCarrier: { iataCode: seg.marketing_carrier.iata_code, name: seg.marketing_carrier.name, logoSymbolUrl: seg.marketing_carrier.logo_symbol_url, logotypeLockupImageUrl: seg.marketing_carrier.logotype_lockup_image_url },
        operatingCarrier: { iataCode: seg.operating_carrier.iata_code, name: seg.operating_carrier.name, logoSymbolUrl: seg.operating_carrier.logo_symbol_url, logotypeLockupImageUrl: seg.operating_carrier.logotype_lockup_image_url },
        aircraft: seg.aircraft ? { iataCode: seg.aircraft.iata_code, name: seg.aircraft.name } : undefined,
      })),
    })),
    owner: { iataCode: o.owner.iata_code, name: o.owner.name, logoSymbolUrl: o.owner.logo_symbol_url, logotypeLockupImageUrl: o.owner.logotype_lockup_image_url },
    documents: o.documents,
    paymentStatus: { awaitingPayment: o.payment_status.awaiting_payment, paymentRequiredBy: o.payment_status.payment_required_by },
  };
}

router.get("/stats/summary", requireAuth, async (req, res) => {
  try {
    const response = await duffel.orders.list({ limit: 200 });
    const rawOrders = response.data as unknown as Array<Record<string, unknown>>;

    const orders = rawOrders.map(formatOrder);

    const totalOrders = orders.length;
    const confirmedOrders = orders.filter((o) => o.status === "confirmed").length;
    const cancelledOrders = orders.filter((o) => o.status === "cancelled").length;

    const totalRevenue = orders
      .filter((o) => o.status === "confirmed")
      .reduce((sum, o) => sum + parseFloat(o.totalAmount as string || "0"), 0)
      .toFixed(2);

    const currency = orders[0]?.totalCurrency ?? "GBP";

    const recentOrders = orders.slice(0, 5);

    const routeCounts: Record<string, number> = {};
    for (const order of orders) {
      const slices = order.slices as Array<{ origin: { iataCode: string }; destination: { iataCode: string } }>;
      if (slices && slices.length > 0) {
        const key = `${slices[0].origin.iataCode}-${slices[0].destination.iataCode}`;
        routeCounts[key] = (routeCounts[key] ?? 0) + 1;
      }
    }

    const topRoutes = Object.entries(routeCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([key, count]) => {
        const [origin, destination] = key.split("-");
        return { origin, destination, count };
      });

    res.json({
      totalOrders,
      confirmedOrders,
      cancelledOrders,
      totalRevenue,
      currency,
      recentOrders,
      topRoutes,
    });
  } catch (err: unknown) {
    req.log.error({ err }, "Error getting stats summary");
    res.status(500).json({ error: "duffel_error", message: "Failed to get stats" });
  }
});

export default router;
