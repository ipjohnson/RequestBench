// go:echo's error contract, against the bodies it actually sends.
//
// The bodies here were taken from the running target, not written from the schema. The two
// rejection branches are the point: a body that will not deserialize and one that fails a
// rule are different layers failing, and each has to be refused by the other's branch.
import { describe, expect, test } from "vitest";
import { askIn, schemaAt, type Answer } from "@rb/schema";
import pkg from "../src/index.js";

const PAIRS = [["customer_id", "int"], ["status", "string"], ["lines", "array"]] as const;

const judge = (endpoint: string, statuses: readonly number[], body: unknown): boolean => {
  const answer = { status: statuses[0]!, body_class: "json", encoding: "", body } as Answer;
  const declared = pkg.schemas[endpoint]!(askIn(pkg.target, endpoint, statuses, PAIRS));
  return schemaAt(declared, answer.status)?.safeParse(answer).success ?? false;
};

// What the target answered to {"customer_id": "not-an-int", "status": 42, "lines": "nope"}.
const notBound = {
  error: "invalid_body",
  detail: "json: cannot unmarshal string into Go struct field orderBody.customer_id of type int",
};
// What it answered to {}, where the body deserialized and the validator ran.
const refused = {
  error: "validation_failed",
  fields: { customer_id: "required", status: "required", lines: "required" },
};

describe(pkg.target, () => {
  test("declares a schema for every error endpoint", () => {
    expect(Object.keys(pkg.schemas).sort()).toEqual([
      "authorized.denied", "body.rejected_all", "body.rejected_first",
      "errors.malformed", "errors.not_found", "errors.unmatched",
    ]);
  });

  test("a body that would not deserialize is the 400 branch", () => {
    expect(judge("body.rejected_all", [400], notBound)).toBe(true);
  });

  test("a body that deserialized and failed a rule is the 422 branch", () => {
    expect(judge("body.rejected_all", [422], refused)).toBe(true);
  });

  test("neither branch accepts the other's envelope", () => {
    expect(judge("body.rejected_all", [400], refused)).toBe(false);
    expect(judge("body.rejected_all", [422], notBound)).toBe(false);
  });

  test("a status it does not declare is refused, not waved through", () => {
    expect(judge("body.rejected_all", [500], notBound)).toBe(false);
  });

  test("rejects this repository's shared envelope, which it no longer answers", () => {
    expect(judge("body.rejected_all", [422], {
      error: "validation_failed",
      errors: PAIRS.map(([field, rule]) => ({ field, rule })),
    })).toBe(false);
  });

  test("the validator has to name at least one field", () => {
    expect(judge("body.rejected_all", [422], { error: "validation_failed", fields: {} }))
      .toBe(false);
  });

  test("a body that is not JSON at all only ever answers 400", () => {
    expect(judge("errors.malformed", [400], { error: "invalid_body", detail: "unexpected EOF" }))
      .toBe(true);
    expect(judge("errors.malformed", [422], refused)).toBe(false);
  });
});
