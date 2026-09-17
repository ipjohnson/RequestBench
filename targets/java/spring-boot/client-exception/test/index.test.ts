// java:spring-boot's error contract, against the bodies it actually sends.
//
// The rejection endpoints answer the unreadable-body envelope, because Jackson fails on the
// plan's type mismatch before Bean Validation runs. The shape the validator does produce is
// checked too, from the exported schema, so it is not left undescribed.
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
import { validationFailure } from "../src/index.js";

const notBound = { error: "invalid_body", detail: "JSON parse error: Cannot deserialize" };
const refused = {
  error: "validation_failed",
  errors: [{ field: "customerId", message: "must not be null" }],
};

describe(pkg.target, () => {
  test("declares a schema for every error endpoint", () => {
    expect(Object.keys(pkg.schemas).sort()).toEqual(EVERY);
  });

  // rb:test body.rejected_all
  test("the plan's body never reaches the validator, so it is the 400 unreadable envelope", () => {
    expect(judge("body.rejected_all", 400, notBound, [400])).toBe(true);
    expect(judge("body.rejected_all", 422, notBound, [400])).toBe(false);
  });

  // rb:test body.rejected_all
  test("this repository's shared envelope is not what it answers", () => {
    expect(judge("body.rejected_all", 400, {
      error: "validation_failed",
      errors: PAIRS.map(([field, rule]) => ({ field, rule })),
    }, [400])).toBe(false);
  });

  // rb:test body.rejected_all
  test("an unreadable body has to carry a detail, not just a name", () => {
    expect(judge("body.rejected_all", 400, { error: "invalid_body" }, [400])).toBe(false);
  });

  test("the shape Bean Validation does produce is described, field and message", () => {
    expect(validationFailure.safeParse(refused).success).toBe(true);
    // The rule vocabulary is Hibernate Validator's, not this repository's.
    expect(validationFailure.safeParse({
      error: "validation_failed",
      errors: [{ field: "customerId", rule: "required" }],
    }).success).toBe(false);
  });
});
