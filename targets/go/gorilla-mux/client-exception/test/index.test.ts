// go:gorilla-mux's error contract, against the bodies it actually sends.
//
// This target validates in the handler, so a wrong type is a validation failure rather than
// a deserialization one, and every wrong field is reported rather than only the first.
import { describe, expect, test } from "vitest";
import { askIn, schemaAt, type Answer } from "@rb/schema";
import pkg from "../src/index.js";

const PAIRS = [["customer_id", "int"], ["status", "string"], ["lines", "array"]] as const;

const judge = (endpoint: string, statuses: readonly number[], body: unknown): boolean => {
  const answer = { status: statuses[0]!, body_class: "json", encoding: "", body } as Answer;
  const declared = pkg.schemas[endpoint]!(askIn(pkg.target, endpoint, statuses, PAIRS));
  return schemaAt(declared, answer.status)?.safeParse(answer).success ?? false;
};

// What the target answered to {"customer_id": "not-an-int", "status": 42, "lines": "nope"}:
// the walk read the body as a value, so it saw all three.
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
    expect(Object.keys(pkg.schemas).sort()).toEqual([
      "authorized.denied", "body.rejected_all", "body.rejected_first",
      "errors.malformed", "errors.not_found", "errors.unmatched",
    ]);
  });

  test("accepts the envelope its own walk produces", () => {
    expect(judge("body.rejected_all", [422], refused)).toBe(true);
  });

  test("the endpoint's own pairs still apply, because this target reports them", () => {
    expect(judge("body.rejected_all", [422], {
      error: "validation_failed",
      errors: [{ field: "customer_id", rule: "int" }],
    })).toBe(false);
  });

  test("rejects the envelope a framework with a binder answers", () => {
    expect(judge("body.rejected_all", [422], {
      error: "validation_failed", fields: { customer_id: "required" },
    })).toBe(false);
  });

  test("a body that is not JSON never reaches the walk, so it is a 400 naming no field", () => {
    expect(judge("errors.malformed", [400], { error: "invalid_body", detail: "unexpected EOF" }))
      .toBe(true);
    expect(judge("errors.malformed", [400], refused)).toBe(false);
  });
});
