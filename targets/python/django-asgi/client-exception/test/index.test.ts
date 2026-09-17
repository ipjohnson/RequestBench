// python:django-asgi's error contract, against the bodies it actually sends.
//
// The interesting case is the one Django does not report: the plan sends status: 42, and
// CharField's to_python calls str() on it, so the form accepts it and names two fields
// rather than three. The contract states that rather than pretending otherwise.
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

const DJANGO = [["customer_id", "invalid"], ["lines", "invalid"]] as const;

// What the form actually put in form.errors for the body the plan sends.
const refused = {
  error: "validation_failed",
  errors: [
    { field: "customer_id", rule: "invalid" },
    { field: "lines", rule: "invalid" },
  ],
};

describe(pkg.target, () => {
  test("declares a schema for every error endpoint", () => {
    expect(Object.keys(pkg.schemas).sort()).toEqual(EVERY);
  });

  // rb:test body.rejected_all
  test("accepts the two fields the form names, in Django's own codes", () => {
    expect(judge("body.rejected_all", 422, refused, DJANGO)).toBe(true);
  });

  // rb:test body.rejected_all
  test("a form that stopped refusing one of them fails", () => {
    expect(judge("body.rejected_all", 422,
      { error: "validation_failed", errors: [refused.errors[0]] }, DJANGO)).toBe(false);
  });

  // rb:test body.rejected_all
  test("this repository's rule names are not Django's, and are not accepted", () => {
    expect(judge("body.rejected_all", 422, {
      error: "validation_failed",
      errors: [{ field: "customer_id", rule: "int" }, { field: "lines", rule: "array" }],
    }, DJANGO)).toBe(false);
  });

  // rb:test errors.malformed
  test("the shared parse giving up is 400 and names no field", () => {
    expect(judge("errors.malformed", 400,
      { error: "invalid_body", detail: "Expecting value: line 1 column 30 (char 29)" })).toBe(true);
    expect(judge("errors.malformed", 400, refused)).toBe(false);
  });
});
