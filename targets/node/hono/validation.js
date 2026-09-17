// Hono's own validation, through hono/validator.
//
// The rules are this target's, but Hono decides when they run: validator("json", fn) is a
// route-level hook that reads and parses the body, hands the value to the check, and short
// circuits with whatever the check returns if it is a Response. The handler then reads the
// value back with c.req.valid("json") and never calls a validator itself.
import { validator } from "hono/validator";
import * as d from "../_shared/domain.js";

/**
 * The order body, checked field by field in the order they are declared.
 *
 * Reading the body as a value rather than binding it to a shape means every wrong field is
 * seen, not only the first one a decoder tripped on. That is what keeps body.rejected_all
 * and body.rejected_first different here.
 */
const req = (errs, obj, field, type) => {
  const v = obj?.[field];
  if (v === undefined || v === null) errs.push({ field, rule: "required" });
  else if (type === "int" && !Number.isInteger(v)) errs.push({ field, rule: "int" });
  else if (type === "string" && typeof v !== "string") errs.push({ field, rule: "string" });
  else if (type === "array" && !Array.isArray(v)) errs.push({ field, rule: "array" });
};

export function checkOrder(body, firstError = false) {
  const errs = [];
  const bail = () => firstError && errs.length > 0;
  req(errs, body, "customer_id", "int");
  if (!bail()) req(errs, body, "status", "string");
  if (!bail()) req(errs, body, "lines", "array");
  if (!bail() && Array.isArray(body?.lines)) {
    if (body.lines.length === 0) errs.push({ field: "lines", rule: "min_length" });
    for (let i = 0; i < body.lines.length && !bail(); i++) {
      const l = body.lines[i];
      if (!Number.isInteger(l?.product_id)) errs.push({ field: `lines[${i}].product_id`, rule: "int" });
      if (!bail() && (!Number.isInteger(l?.qty) || l.qty < 1)) errs.push({ field: `lines[${i}].qty`, rule: "min" });
    }
  }
  return errs;
}

/** This target's own envelope for a body its walk refused. */
export const refused = (errors) => ({ error: "validation_failed", errors });

/** This target's own envelope for a body the parser could not read at all. */
export const notBound = (message) => ({ error: "invalid_body", detail: message });

/** The order, once the walk has said the body is one. */
export const orderOf = (body) => d.priceOrder(body.customer_id, body.status, body.lines);

/** The hook a route mounts to have Hono run the check before the handler. */
export const validatesOrder = (firstError = false) =>
  validator("json", (value, c) => {
    const errs = checkOrder(value, firstError);
    if (errs.length) return c.json(refused(errs), 422);
    return value;
  });
