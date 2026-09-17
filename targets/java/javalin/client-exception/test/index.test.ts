// java:javalin's error contract, against the bodies it actually sends.
//
// One envelope for both a failed check and a failed deserialization, because bodyValidator
// raises the same exception for both. The field is what Javalin was validating, not the
// field inside it.
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

const deserialization = {
  error: "validation_failed",
  errors: [{ field: "REQUEST_BODY", message: "DESERIALIZATION_FAILED" }],
};
const checks = {
  error: "validation_failed",
  errors: [
    { field: "REQUEST_BODY", message: "customer_id is required" },
    { field: "REQUEST_BODY", message: "status is required" },
  ],
};

describe(pkg.target, () => {
  test("declares a schema for every error endpoint", () => {
    expect(Object.keys(pkg.schemas).sort()).toEqual(EVERY);
  });

  test("a failed deserialization and a failed check are the same envelope at 400", () => {
    expect(judge("body.rejected_all", 400, deserialization, [400])).toBe(true);
    expect(judge("body.rejected_all", 400, checks, [400])).toBe(true);
    expect(judge("errors.malformed", 400, deserialization, [400])).toBe(true);
  });

  test("422 is not what it answers", () => {
    expect(judge("body.rejected_all", 422, deserialization, [400])).toBe(false);
  });

  test("this repository's field and rule pair is not Javalin's shape", () => {
    expect(judge("body.rejected_all", 400, {
      error: "validation_failed",
      errors: PAIRS.map(([field, rule]) => ({ field, rule })),
    }, [400])).toBe(false);
  });
});
