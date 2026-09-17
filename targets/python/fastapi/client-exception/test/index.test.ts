// python:fastapi's error contract, against the bodies it actually sends.
//
// Both bodies here are 422 in the same envelope: Pydantic treats an unreadable body and a
// wrong type as the same kind of finding, and only the entry's `type` separates them. That
// is what the malformed schema pins.
import { describe, expect, test } from "vitest";
import { askIn, schemaAt, type Answer } from "@rb/schema";
import pkg from "../src/index.js";

const PAIRS = [["customer_id", "int"], ["status", "string"], ["lines", "array"]] as const;

// The endpoint declares 422 and the answer arrives with whatever status it arrives with.
// These are separate on purpose: letting the caller declare the status it is testing makes
// every status assertion pass for the endpoints this package does not override.
const judge = (
  endpoint: string, answered: number, body: unknown,
  pairs: readonly (readonly [string, string])[] = PAIRS,
): boolean => {
  const answer = { status: answered, body_class: "json", encoding: "", body } as Answer;
  const declared = pkg.schemas[endpoint]!(askIn(pkg.target, endpoint, [422], pairs));
  return schemaAt(declared, answered)?.safeParse(answer).success ?? false;
};

const EVERY = [
  "authorized.denied", "body.rejected_all", "body.rejected_first",
  "errors.malformed", "errors.not_found", "errors.unmatched",
];

const typeError = {
  detail: [
    { type: "int_parsing", loc: ["body", "customer_id"],
      msg: "Input should be a valid integer, unable to parse string as an integer",
      input: "not-an-int" },
    { type: "string_type", loc: ["body", "status"],
      msg: "Input should be a valid string", input: 42 },
    { type: "list_type", loc: ["body", "lines"],
      msg: "Input should be a valid list", input: "nope" },
  ],
};
const jsonError = {
  detail: [
    { type: "json_invalid", loc: ["body", 29], msg: "JSON decode error", input: {},
      ctx: { error: "Expecting value" } },
  ],
};

describe(pkg.target, () => {
  test("declares a schema for every error endpoint", () => {
    expect(Object.keys(pkg.schemas).sort()).toEqual(EVERY);
  });

  // rb:test body.rejected_all
  test("all three findings are reported, and 422 is the answer for a wrong type", () => {
    expect(judge("body.rejected_all", 422, typeError)).toBe(true);
    expect(judge("body.rejected_all", 400, typeError)).toBe(false);
  });

  // rb:test errors.malformed
  test("a body that would not parse is the same envelope at the same status", () => {
    expect(judge("errors.malformed", 422, jsonError)).toBe(true);
  });

  // rb:test errors.malformed
  test("but the type is pinned there, so a validation finding is not accepted for it", () => {
    expect(judge("errors.malformed", 422, typeError)).toBe(false);
  });

  // rb:test body.rejected_all
  test("rejects this repository's shared envelope, which FastAPI no longer answers", () => {
    expect(judge("body.rejected_all", 422, {
      error: "validation_failed",
      errors: PAIRS.map(([field, rule]) => ({ field, rule })),
    })).toBe(false);
  });

  // rb:test body.rejected_all
  test("rejects a finding that grew a key", () => {
    expect(judge("body.rejected_all", 422,
      { detail: [{ ...typeError.detail[0], extra: 1 }] })).toBe(false);
  });
});
