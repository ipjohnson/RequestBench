// python:flask's error contract, against the bodies it actually sends.
//
// The bodies here were taken from the running target. The first-error case is the one worth
// keeping: this target reads the body as a value, so it can stop after one field, which
// neither fastapi nor litestar can.
import { describe, expect, test } from "vitest";
import { askIn, schemaAt, type Answer } from "@rb/schema";
import pkg from "../src/index.js";

const PAIRS = [["customer_id", "int"], ["status", "string"], ["lines", "array"]] as const;

const judge = (
  endpoint: string, status: number, body: unknown,
  pairs: readonly (readonly [string, string])[] = PAIRS,
): boolean => {
  const answer = { status, body_class: "json", encoding: "", body } as Answer;
  const declared = pkg.schemas[endpoint]!(askIn(pkg.target, endpoint, [status], pairs));
  return schemaAt(declared, status)?.safeParse(answer).success ?? false;
};

const EVERY = [
  "authorized.denied", "body.rejected_all", "body.rejected_first",
  "errors.malformed", "errors.not_found", "errors.unmatched",
];

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
      [["customer_id", "int"]])).toBe(true);
  });

  test("the endpoint's own pairs still apply, because this target reports them", () => {
    expect(judge("body.rejected_all", 422,
      { error: "validation_failed", errors: [refused.errors[0]] })).toBe(false);
  });

  test("rejects the envelopes the other Python targets answer", () => {
    expect(judge("body.rejected_all", 422, { detail: [{ type: "int_parsing", loc: ["body", "customer_id"], msg: "x", input: "y" }] })).toBe(false);
    expect(judge("body.rejected_all", 422, { status_code: 400, detail: "x", extra: [{ message: "m", key: "customer_id", source: "body" }] })).toBe(false);
  });

  test("a body that is not JSON never reaches the walk, so it is 400 naming no field", () => {
    expect(judge("errors.malformed", 400,
      { error: "invalid_body", detail: "Expecting value: line 1 column 30 (char 29)" })).toBe(true);
    expect(judge("errors.malformed", 400, refused)).toBe(false);
  });
});
