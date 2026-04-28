import { Duffel } from "@duffel/api";

const token = process.env.DUFFEL_ACCESS_TOKEN;

if (!token) {
  throw new Error("DUFFEL_ACCESS_TOKEN environment variable is required");
}

export const duffel = new Duffel({ token });
