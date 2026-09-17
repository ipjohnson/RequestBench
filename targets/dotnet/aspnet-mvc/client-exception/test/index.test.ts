// dotnet:aspnet-mvc's error contract, against the bodies it actually sends.
//
// One envelope covers both layers, because MVC routes a parse failure through ModelState as well. A wrong type is keyed by the JSON path it failed at, a missing field by the CLR property name.
import { describe, expect, test } from "vitest";
import { askIn, schemaAt, type Answer } from "@rb/schema";
import pkg, { validationFailure } from "../src/index.js";

const PAIRS = [["customer_id", "int"], ["status", "string"], ["lines", "array"]] as const;
const EVERY = [
  "authorized.denied", "body.rejected_all", "body.rejected_first",
  "errors.malformed", "errors.not_found", "errors.unmatched",
];

// The endpoint's declaration and the answered status are separate, so a status assertion
// cannot pass just because the caller declared the status it was testing.
const judge = (endpoint: string, answered: number, body: unknown): boolean => {
  const answer = { status: answered, body_class: "json", encoding: "", body } as Answer;
  const resolved = pkg.schemas[endpoint]!(askIn(pkg.target, endpoint, [422], PAIRS));
  return schemaAt(resolved, answered)?.safeParse(answer).success ?? false;
};

// What the target answered to {"customer_id": "not-an-int", ...} and to a truncated body.
const notBound = { type: "https://tools.ietf.org/html/rfc9110#section-15.5.1", title: "One or more validation errors occurred.", status: 400, errors: { body: ["The body field is required."], "$.customer_id": ["The JSON value could not be converted."] }, traceId: "00-a-01" };

// What it answers when its validator is reached, which the plan never does.
const refused = { type: "about:blank", title: "One or more validation errors occurred.", status: 400, errors: { CustomerId: ["The CustomerId field is required."] } };

describe(pkg.target, () => {
  test("declares a schema for every error endpoint", () => {
    expect(Object.keys(pkg.schemas).sort()).toEqual(EVERY);
  });

  test("the rejection endpoints answer the unreadable-body envelope at 400", () => {
    expect(judge("body.rejected_all", 400, notBound)).toBe(true);
    expect(judge("body.rejected_all", 422, notBound)).toBe(false);
  });

  test("a body that is not JSON at all is the same envelope", () => {
    expect(judge("errors.malformed", 400, notBound)).toBe(true);
  });

  test("this repository's shared envelope is not what it answers", () => {
    expect(judge("body.rejected_all", 400, {
      error: "validation_failed",
      errors: PAIRS.map(([field, rule]) => ({ field, rule })),
    })).toBe(false);
  });

  test("the shape its validator produces is described, not left undescribed", () => {
    expect(validationFailure.safeParse(refused).success).toBe(true);
  });

  test("the errors map is required here, where minimal-apis has none", () => {
    expect(judge("body.rejected_all", 400, {
      type: "about:blank", title: "Bad Request", status: 400,
    })).toBe(false);
  });

  test("traceId comes and goes with tracing and is pinned neither way", () => {
    const { traceId: _drop, ...rest } = notBound as Record<string, unknown>;
    expect(judge("body.rejected_all", 400, rest)).toBe(true);
  });
});
