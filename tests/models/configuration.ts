/**
 * The values every framework configures itself with, where that framework usually configures them:
 * on the route, in its own configuration, or as a default. tests/README.md states them, and the
 * tests send them.
 */

/** The bearer token the authorized family presents. */
export const TOKEN = "5a7cc77ed0dcb825806b6f872026c317";

/** The one policy every framework attaches to /cors. */
export const CORS = {
  origin: "https://shop.example.com",
  method: "GET",
  header: "x-rb-tenant",
  maxAgeSeconds: 600,
} as const;
