// dotnet:carter's error contract, against the bodies it actually sends.
//
// The binder runs before Carter's validation filter, so a body it could not read never reaches the validator. That answers a bare ProblemDetails, the same as minimal-apis.
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
const notBound = { type: "https://tools.ietf.org/html/rfc9110#section-15.5.1", title: "Bad Request", status: 400 };

// What Carter's filter answered to {"customer_id":1,"status":"open","lines":[]}, a body that binds and breaks one rule. The plan never sends one.
const refused = { type: "https://tools.ietf.org/html/rfc4918#section-11.2", title: "Unprocessable Entity", status: 422, errors: [{ property_name: "Lines", error_message: "'Lines' must have at least one entry." }] };

// What the route answered before Carter's filter took validation over: 400, grouped by field.
const refusedByTheRoute = { type: "https://tools.ietf.org/html/rfc9110#section-15.5.1", title: "One or more validation errors occurred.", status: 400, errors: { Lines: ["'Lines' must have at least one entry."] } };

describe(pkg.target, () => {
  test("declares a schema for every error endpoint", () => {
    expect(Object.keys(pkg.schemas).sort()).toEqual(EVERY);
  });

  // rb:test body.rejected_all
  test("the rejection endpoints answer the unreadable-body envelope at 400", () => {
    expect(judge("body.rejected_all", 400, notBound)).toBe(true);
    expect(judge("body.rejected_all", 422, notBound)).toBe(false);
  });

  // rb:test errors.malformed
  test("a body that is not JSON at all is the same envelope", () => {
    expect(judge("errors.malformed", 400, notBound)).toBe(true);
  });

  // rb:test body.rejected_all
  test("this repository's shared envelope is not what it answers", () => {
    expect(judge("body.rejected_all", 400, {
      error: "validation_failed",
      errors: PAIRS.map(([field, rule]) => ({ field, rule })),
    })).toBe(false);
  });

  test("the shape its validator produces is described, not left undescribed", () => {
    expect(validationFailure.safeParse(refused).success).toBe(true);
  });

  test("Carter answers 422 with a list, not the 400 map the route used to build", () => {
    expect(validationFailure.safeParse(refusedByTheRoute).success).toBe(false);
    expect(validationFailure.safeParse({ ...refused, status: 400 }).success).toBe(false);
  });

  test("a refusal that lists no failure is not an answer", () => {
    expect(validationFailure.safeParse({ ...refused, errors: [] }).success).toBe(false);
  });

  test("FluentValidation reports its own wording, not this repository's rule names", () => {
    expect(validationFailure.safeParse({
      ...refused,
      errors: [{ property_name: "CustomerId", error_message: "'Customer Id' must not be empty." }],
    }).success).toBe(true);
  });
});
