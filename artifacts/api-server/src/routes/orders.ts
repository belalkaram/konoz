import { Router } from "express";
import { duffel } from "../lib/duffel";
import { CreateOrderBody, ListOrdersQueryParams, GetOrderParams, CancelOrderParams } from "@workspace/api-zod";
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
      origin: {
        iata_code: string;
        name: string;
        city_name: string;
        iata_country_code: string;
      };
      destination: {
        iata_code: string;
        name: string;
        city_name: string;
        iata_country_code: string;
      };
      duration: string;
      segments: Array<{
        id: string;
        origin: {
          iata_code: string;
          name: string;
          city_name: string;
          iata_country_code: string;
        };
        destination: {
          iata_code: string;
          name: string;
          city_name: string;
          iata_country_code: string;
        };
        departing_at: string;
        arriving_at: string;
        duration: string;
        marketing_carrier: {
          iata_code: string;
          name: string;
          logo_symbol_url: string | null;
          logotype_lockup_image_url: string | null;
          marketing_carrier_flight_number?: string;
        };
        marketing_carrier_flight_number: string;
        operating_carrier: {
          iata_code: string;
          name: string;
          logo_symbol_url: string | null;
          logotype_lockup_image_url: string | null;
        };
        aircraft: {
          iata_code: string;
          name: string;
        } | null;
      }>;
    }>;
    owner: {
      iata_code: string;
      name: string;
      logo_symbol_url: string | null;
      logotype_lockup_image_url: string | null;
    };
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
    owner: {
      iataCode: o.owner.iata_code,
      name: o.owner.name,
      logoSymbolUrl: o.owner.logo_symbol_url,
      logotypeLockupImageUrl: o.owner.logotype_lockup_image_url,
    },
    documents: o.documents,
    paymentStatus: {
      awaitingPayment: o.payment_status.awaiting_payment,
      paymentRequiredBy: o.payment_status.payment_required_by,
    },
  };
}

router.get("/orders", requireAuth, async (req, res) => {
  const parsed = ListOrdersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      error: "validation_error",
      message: parsed.error.message,
    });
    return;
  }

  const { limit, after, before } = parsed.data;

  try {
    const params: { limit?: number; after?: string; before?: string } = {
      limit: limit ?? 20,
    };
    if (after) params.after = after;
    if (before) params.before = before;

    const response = await duffel.orders.list(params);
    const orders = response.data.map((o) => formatOrder(o as unknown as Record<string, unknown>));

    res.json({
      orders,
      meta: {
        limit: limit ?? 20,
        before: response.meta?.before ?? null,
        after: response.meta?.after ?? null,
      },
    });
  } catch (err: unknown) {
    req.log.error({ err }, "Error listing orders");
    res.status(500).json({ error: "duffel_error", message: "Failed to list orders" });
  }
});

router.post("/orders", requireAuth, async (req, res) => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "validation_error",
      message: parsed.error.message,
    });
    return;
  }

  const { selectedOfferId, passengers, type } = parsed.data;

  try {
    const { data: order } = await duffel.orders.create({
      selected_offers: [selectedOfferId],
      passengers: passengers.map((p) => ({
        id: p.id,
        title: p.title as "mr" | "ms" | "mrs" | "miss" | "dr" | undefined,
        given_name: p.givenName,
        family_name: p.familyName,
        gender: p.gender as "m" | "f",
        born_on: p.bornOn,
        email: p.email,
        phone_number: p.phoneNumber,
        ...(p.passportNumber ? { passport_number: p.passportNumber } : {}),
        ...(p.passportExpiryDate
          ? { passport_expiry_date: p.passportExpiryDate }
          : {}),
        ...(p.nationalityIataCountryCode
          ? { nationality_iata_country_code: p.nationalityIataCountryCode }
          : {}),
      })),
      type: (type ?? "instant") as "instant" | "hold",
      payments: [
        {
          type: "balance",
          currency: "GBP",
          amount: "0",
        },
      ],
    });

    req.log.info({ event: "security:payment_created", actorId: req.employee?.employeeId, ip: req.ip }, "Order created");
    res.status(201).json(formatOrder(order as unknown as Record<string, unknown>));
  } catch (err: unknown) {
    req.log.error({ err }, "Error creating order");
    res.status(400).json({ error: "duffel_error", message: "Failed to create order" });
  }
});

router.get("/orders/:orderId", requireAuth, async (req, res) => {
  const parsed = GetOrderParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({
      error: "validation_error",
      message: parsed.error.message,
    });
    return;
  }

  const { orderId } = parsed.data;

  try {
    const { data: order } = await duffel.orders.get(orderId);
    res.json(formatOrder(order as unknown as Record<string, unknown>));
  } catch (err: unknown) {
    req.log.error({ err }, "Error getting order");
    res.status(404).json({ error: "not_found", message: "Order not found" });
  }
});

router.post("/orders/:orderId/cancel", requireAuth, async (req, res) => {
  const parsed = CancelOrderParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({
      error: "validation_error",
      message: parsed.error.message,
    });
    return;
  }

  const { orderId } = parsed.data;

  try {
    const { data: cancellation } = await duffel.orderCancellations.create({
      order_id: orderId,
    });

    await duffel.orderCancellations.confirm(cancellation.id);

    res.json({
      id: cancellation.id,
      orderId: cancellation.order_id,
      refundAmount: cancellation.refund_amount,
      refundCurrency: cancellation.refund_currency,
      refundTo: cancellation.refund_to,
      confirmedAt: cancellation.confirmed_at,
      expiresAt: cancellation.expires_at,
    });
  } catch (err: unknown) {
    req.log.error({ err }, "Error cancelling order");
    res.status(400).json({ error: "duffel_error", message: "Failed to cancel order" });
  }
});

export default router;
