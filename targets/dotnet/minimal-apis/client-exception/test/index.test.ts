// dotnet:minimal-apis's error contract, against the bodies it actually sends.
//
// A body the framework could not read is a bare ProblemDetails with no errors at all. That is where minimal APIs differs from MVC, which routes a parse failure through ModelState and answers the same shape either way.
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

// What it answers when its validator is reached, which the plan never does.
const refused = { title: "One or more validation errors occurred.", errors: { CustomerId: ["The CustomerId field is required."] } };

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

  // rb:test body.rejected_all
  test("an errors map is not what an unreadable body answers here", () => {
    expect(judge("body.rejected_all", 400, {
      type: "about:blank", title: "One or more validation errors occurred.", status: 400,
      errors: { CustomerId: ["required"] },
    })).toBe(false);
  });

  test("AddValidation writes no type or status of its own, unlike Results.ValidationProblem", () => {
    expect(validationFailure.safeParse({
      type: "about:blank", title: "x", status: 400, errors: { CustomerId: ["y"] },
    }).success).toBe(false);
  });
});
