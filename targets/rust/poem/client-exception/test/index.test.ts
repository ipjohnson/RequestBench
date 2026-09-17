// rust:poem's error contract, against the bodies it actually sends.
//
// poem answers 400 for both layers and renders as text, so the whole body is one string.
import { describe, expect, test } from "vitest";
import { askIn, schemaAt, type Answer } from "@rb/schema";
import pkg, { ownChecks } from "../src/index.js";

const PAIRS = [["customer_id", "int"], ["status", "string"], ["lines", "array"]] as const;
const EVERY = [
  "authorized.denied", "body.rejected_all", "body.rejected_first",
  "errors.malformed", "errors.not_found", "errors.unmatched",
];

// The endpoint's declaration and the answered status are separate, so a status assertion
// cannot pass just because the caller declared the status it was testing.
const judge = (
  endpoint: string, answered: number, body_class: string, body: unknown,
): boolean => {
  const answer = { status: answered, body_class, encoding: "", body } as Answer;
  const resolved = pkg.schemas[endpoint]!(askIn(pkg.target, endpoint, [422], PAIRS));
  return schemaAt(resolved, answered)?.safeParse(answer).success ?? false;
};

describe(pkg.target, () => {
  test("declares a schema for every error endpoint", () => {
    expect(Object.keys(pkg.schemas).sort()).toEqual(EVERY);
  });

  test("the extractor's own rejection is what the rejection endpoints answer", () => {
    expect(judge("body.rejected_all", 400, "text", "parse error: invalid type: string \"not-an-int\", expected i64 at line 1 column 27")).toBe(true);
  });

  test("a body that is not JSON at all answers 400", () => {
    expect(judge("errors.malformed", 400, "text", "parse error: EOF while parsing a list at line 1 column 29")).toBe(true);
  });

  test("this repository's shared envelope is not what it answers", () => {
    expect(judge("body.rejected_all", 400, "json", {
      error: "validation_failed",
      errors: PAIRS.map(([field, rule]) => ({ field, rule })),
    })).toBe(false);
  });

  test("the kind of body matters, not only the status", () => {
    expect(judge("body.rejected_all", 400, "text" === "text" ? "json" : "text", "parse error: invalid type: string \"not-an-int\", expected i64 at line 1 column 27"))
      .toBe(false);
  });

  // The plan never sends a body of the right shape with wrong values, so this path is not
  // reached by any endpoint. It is described anyway, because it is what this target answers
  // when its own checks run -- and it is the reason body.rejected_first still differs here.
  test("its own checks answer a field and a rule, and can stop at the first", () => {
    expect(ownChecks.safeParse({
      error: "validation_failed",
      errors: [{ field: "lines", rule: "min_length" }],
    }).success).toBe(true);
    expect(ownChecks.safeParse({
      error: "validation_failed",
      errors: [{ field: "lines", message: "min_length" }],
    }).success).toBe(false);
  });
});
