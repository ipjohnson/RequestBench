// java:helidon-se's error contract, against the bodies it actually sends.
//
// The only Java target where body.rejected_first is still a different answer, and the only
// one still answering 422, because its walk reads the body as a value rather than binding it.
import { describe, expect, test } from "vitest";
import { askIn, schemaAt, type Answer } from "@rb/schema";
import pkg from "../src/index.js";

const PAIRS = [["customer_id", "int"], ["status", "string"], ["lines", "array"]] as const;
const EVERY = [
  "authorized.denied", "body.rejected_all", "body.rejected_first",
  "errors.malformed", "errors.not_found", "errors.unmatched",
];

// The endpoint's declaration and the answered status are separate: letting the caller
// declare the status it is testing makes every status assertion pass for free.
const judge = (
  endpoint: string, answered: number, body: unknown,
  declared: readonly number[] = [422],
  pairs: readonly (readonly [string, string])[] = PAIRS,
): boolean => {
  const answer = { status: answered, body_class: "json", encoding: "", body } as Answer;
  const resolved = pkg.schemas[endpoint]!(askIn(pkg.target, endpoint, declared, pairs));
  return schemaAt(resolved, answered)?.safeParse(answer).success ?? false;
};

const refused = {
  error: "validation_failed",
  errors: [
    { field: "customer_id", rule: "int" },
    { field: "status", rule: "string" },
    { field: "lines", rule: "array" },
  ],
};

describe(pkg.target, () => {
  test("declares a schema for every error endpoint", () => {
    expect(Object.keys(pkg.schemas).sort()).toEqual(EVERY);
  });

  test("accepts the envelope its own walk produces, with every field named", () => {
    expect(judge("body.rejected_all", 422, refused)).toBe(true);
  });

  test("the first-error row reports one field, and that is still this envelope", () => {
    expect(judge("body.rejected_first", 422,
      { error: "validation_failed", errors: [refused.errors[0]] },
      [422], [["customer_id", "int"]])).toBe(true);
  });

  test("the endpoint's own pairs still apply, because this target reports them", () => {
    expect(judge("body.rejected_all", 422,
      { error: "validation_failed", errors: [refused.errors[0]] })).toBe(false);
  });

  test("rejects the envelopes the other five Java targets answer", () => {
    expect(judge("body.rejected_all", 422, { error: "invalid_body", detail: "x" })).toBe(false);
    expect(judge("body.rejected_all", 422, {
      error: "validation_failed", detail: "[Bad Request] Validation error",
    })).toBe(false);
    expect(judge("body.rejected_all", 422, {
      error: "validation_failed",
      errors: [{ field: "customerId", message: "must not be null" }],
    })).toBe(false);
  });

  test("a body that is not JSON never reaches the walk, so it is 400 naming no field", () => {
    expect(judge("errors.malformed", 400, {
      error: "invalid_body", detail: "Failed to deserialize JSON to interface java.util.Map",
    }, [400])).toBe(true);
    expect(judge("errors.malformed", 400, refused, [400])).toBe(false);
  });
});
