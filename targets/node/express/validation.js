// express's own validation.
//
// express has no validation layer to plug into, so the handler validates and this file is where
// it lives. It is this target's copy on purpose: sharing one walk across five frameworks
// measured the shared walk rather than the framework, which is the defect #35 describes.
// Nothing else imports it.
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

// rb:wiring body.*
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
// rb:wiring body.*,errors.*
export const refused = (errors) => ({ error: "validation_failed", errors });

/** This target's own envelope for a body the parser could not read at all. */
export const notBound = (message) => ({ error: "invalid_body", detail: message });

/** The order, once the walk has said the body is one. */
export const orderOf = (body) => d.priceOrder(body.customer_id, body.status, body.lines);
// rb:end
