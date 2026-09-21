import { z } from "zod";

/** Two values, so a store that ignores the header holds one entry where two keys were sent. */
const values = z.array(z.string().min(1)).min(2);

/**
 * Values a framework configures itself from, published beside the item payloads
 * so that no framework copies a token or a policy into its own source by hand.
 */
export const settings = z.strictObject({
  /** The bearer token the authorized family presents. */
  token: z.string().min(1),
  /** The token with its last character changed, so a refusal compares the whole string. */
  wrongToken: z.string().min(1),
  /** A validator no framework computes, for the conditional request that has to be answered in full. */
  staleEtag: z.string().min(1),
  cache: z.strictObject({
    /** Enough entries for every key the cache family stores, so nothing is evicted mid-run. */
    capacity: z.number().int().positive(),
    ttlSeconds: z.number().int().positive(),
    /** The values each vary row is keyed on, by header. */
    vary: z.strictObject({
      one: z.strictObject({ "x-rb-tenant": values }),
      many: z.strictObject({ "x-rb-channel": values, "x-rb-region": values, "x-rb-tenant": values }),
    }),
  }),
  /** The one policy every framework attaches to /cors. */
  cors: z.strictObject({
    origin: z.string().url(),
    method: z.string().min(1),
    header: z.string().min(1),
    maxAgeSeconds: z.number().int().positive(),
  }),
});
