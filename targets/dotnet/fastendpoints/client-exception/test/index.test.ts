// dotnet:fastendpoints's error contract, against the bodies it actually sends.
//
// The only one of the five that separates the layers: 400 when the binder could not read the body, 422 when the validator refused it. And the only one reporting the field by its name on the wire.
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
const notBound = { status_code: 400, message: "One or more errors occurred!", errors: { customer_id: ["Either the JSON value is not in a supported format, or is out of bounds for an Int32."] } };

// What it answers when its validator is reached, which the plan never does.
const refused = { status_code: 422, message: "One or more errors occurred!", errors: { customer_id: ["'customer_id' must not be empty."] } };

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

  test("the validator answers 422, which is the layer the other four do not separate", () => {
    expect(validationFailure.safeParse(refused).success).toBe(true);
    expect((refused as { status_code: number }).status_code).toBe(422);
  });

  test("it reports the wire name, not the CLR property", () => {
    expect(Object.keys((refused as { errors: Record<string, unknown> }).errors))
      .toEqual(["customer_id"]);
  });

  test("ProblemDetails is not what this framework answers", () => {
    expect(judge("body.rejected_all", 400, {
      type: "about:blank", title: "Bad Request", status: 400,
    })).toBe(false);
  });
});
