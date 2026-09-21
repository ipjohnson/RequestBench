import { z } from "zod";
import { item } from "#models/item";

/**
 * The controlled variable: three fixed answers every feature family reuses
 * unchanged, so subtracting a base row from its arm leaves the feature and
 * nothing else.
 *
 * The row count is part of the shape. A framework serving eighty-eight rows is
 * doing less work than its neighbor, and a schema that checked only the element
 * type would let it.
 */
function payload<S extends string, N extends number>(size: S, count: N) {
  return z.strictObject({
    size: z.literal(size),
    count: z.literal(count),
    items: z.array(item).length(count),
  });
}

/** The rows in the large payload, which is also the range an item id is drawn from. */
export const LARGE = 1425;

export const payloadSmall = payload("small", 1);
export const payloadMedium = payload("medium", 89);
export const payloadLarge = payload("large", LARGE);
