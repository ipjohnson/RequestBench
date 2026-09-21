import { z } from "zod";

export const CATEGORIES = ["tools", "garden", "kitchen", "outdoor", "office"] as const;

/** One row of the payload that every family serialises. */
export const item = z.strictObject({
  id: z.number().int().positive(),
  name: z.string().min(1),
  category: z.enum(CATEGORIES),
  priceCents: z.number().int().nonnegative(),
  inStock: z.boolean(),
});

/** An item as a client creates or replaces one. The id is the path's, or the server's to give. */
export const newItem = item.omit({ id: true });

/** The two fields items.update changes. */
export const itemPatch = item.pick({ priceCents: true, inStock: true });
