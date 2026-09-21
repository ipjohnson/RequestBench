import { z } from "zod";

/**
 * The body the bind and validate rows send. The orders themselves are the
 * payloads order.small and order.medium.
 *
 * Their line counts put the serialised request in the same size regime as the
 * response payload of the same name, so `body.validate_medium` minus
 * `body.validate_small` is the parser and the validator at scale rather than two
 * unrelated bodies. order.invalid is wrong on all three fields, which is what the
 * two error contracts disagree about: a framework that collects names three and
 * one that stops at the first names one.
 */
export const orderRequest = z.strictObject({
  customerId: z.number().int().positive(),
  status: z.string().min(1),
  lines: z
    .array(z.strictObject({ productId: z.number().int().positive(), qty: z.number().int().positive() }))
    .min(1),
});
