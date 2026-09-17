// java:micronaut's error contract, against the bodies it actually sends.
//
// The HAL scaffolding is allowed through on purpose -- its link set varies -- so the test's
// job is to show the looseness is bounded: another framework's envelope is still refused.
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

// Micronaut's own answer for a body it could not read, as it writes it.
const hal = {
  message: "Invalid JSON",
  _embedded: {
    errors: [{
      message: "Invalid JSON: Cannot deserialize value of type `java.lang.Integer`",
      _embedded: {}, _links: {}, logref: null, path: null,
    }],
  },
  _links: { self: { href: "/body/validate/small", templated: false } },
};

describe(pkg.target, () => {
  test("declares a schema for every error endpoint", () => {
    expect(Object.keys(pkg.schemas).sort()).toEqual(EVERY);
  });

  test("accepts the HAL envelope Micronaut writes", () => {
    expect(judge("body.rejected_all", 400, hal, [400])).toBe(true);
  });

  test("a link set that grew is still the same envelope, which is why HAL is not pinned", () => {
    const more = { ...hal, _links: { ...hal._links, next: { href: "/x" } } };
    expect(judge("body.rejected_all", 400, more, [400])).toBe(true);
  });

  test("but the message paths are required, so an empty HAL body is refused", () => {
    expect(judge("body.rejected_all", 400, { message: "Invalid JSON", _links: {} }, [400]))
      .toBe(false);
    expect(judge("body.rejected_all", 400,
      { message: "x", _embedded: { errors: [] }, _links: {} }, [400])).toBe(false);
  });

  test("and the looseness is bounded: no other framework's envelope is accepted", () => {
    expect(judge("body.rejected_all", 400, { error: "invalid_body", detail: "x" }, [400]))
      .toBe(false);
    expect(judge("body.rejected_all", 400, {
      error: "validation_failed",
      errors: PAIRS.map(([field, rule]) => ({ field, rule })),
    }, [400])).toBe(false);
  });

  test("the shape the generated validator produces is described, field and message", () => {
    expect(validationFailure.safeParse({
      error: "validation_failed",
      errors: [{ field: "validateSmall.body.customerId", message: "must not be null" }],
    }).success).toBe(true);
  });
});
