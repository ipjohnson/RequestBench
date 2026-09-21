import { z } from "zod";
import { orderRequest } from "#models/order-request";

/**
 * What a bind or validate row answers: the body back, with a count of its
 * leaves and its length beside it. The validate rows answer the same thing, so
 * validate minus bind is the validator alone.
 *
 * `fields` is the load-bearing field. Without something derived from the parsed
 * structure a framework could pipe the request bytes straight to the response and
 * never parse at all, and comparing bodies would not see it.
 */
export const bindEcho = z.strictObject({
  fields: z.number().int().positive(),
  bytes: z.number().int().positive(),
  echo: orderRequest,
});
