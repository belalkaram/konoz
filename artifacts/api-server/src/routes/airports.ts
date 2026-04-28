import { Router } from "express";
import { duffel } from "../lib/duffel";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

router.get("/airports/search", requireAuth, async (req, res) => {
  const query = String(req.query.query ?? "").trim();

  if (query.length < 1) {
    res.json({ airports: [] });
    return;
  }

  try {
    const response = await duffel.suggestions.list({ query });

    const airports = response.data
      .filter((place) => place.type === "airport")
      .slice(0, 10)
      .map((place) => ({
        iataCode: place.iata_code,
        name: place.name,
        cityName: place.city_name,
        countryName: place.iata_country_code,
      }));

    res.json({ airports });
  } catch (err: unknown) {
    req.log.error({ err }, "Error searching airports");
    res.json({ airports: [] });
  }
});

export default router;
