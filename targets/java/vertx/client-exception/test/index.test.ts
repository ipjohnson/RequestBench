// java:vertx's error contract, against the bodies it actually sends.
//
// One envelope and one detail, because the ValidationHandler fails the context on the first
// thing that did not fit. A parse failure and a schema failure differ only in the wording.
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

const schemaFailure = {
  error: "validation_failed",
  detail: "[Bad Request] Validation error for body application/json: null: "
    + "{ errors: [], annotations: []}",
};
const parseFailure = {
  error: "validation_failed",
  detail: "[Bad Request] Json body application/json parsing error: Failed to decode",
};

describe(pkg.target, () => {
  test("declares a schema for every error endpoint", () => {
    expect(Object.keys(pkg.schemas).sort()).toEqual(EVERY);
  });

  // rb:test body.rejected_all,errors.malformed
  test("both failures are the same envelope at 400", () => {
    expect(judge("body.rejected_all", 400, schemaFailure, [400])).toBe(true);
    expect(judge("errors.malformed", 400, parseFailure, [400])).toBe(true);
  });

  // rb:test body.rejected_all
  test("there is no errors list: one detail is what the handler gives", () => {
    expect(judge("body.rejected_all", 400, {
      error: "validation_failed",
      errors: PAIRS.map(([field, rule]) => ({ field, rule })),
    }, [400])).toBe(false);
  });

  // rb:test body.rejected_all
  test("a detail is required, so a bare name is refused", () => {
    expect(judge("body.rejected_all", 400, { error: "validation_failed" }, [400])).toBe(false);
  });
});
