// python:litestar's error contract, against the bodies it actually sends.
//
// Two envelopes at the same status: msgspec refusing a field carries `extra`, and a body it
// could not read at all does not, because nothing reached a field.
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
  status_code: 400,
  detail: "Validation failed for POST /body/validate/small",
  extra: [{ message: "Expected `int`, got `str`", key: "customer_id", source: "body" }],
};
const truncated = { status_code: 400, detail: "Input data was truncated" };

describe(pkg.target, () => {
  test("declares a schema for every error endpoint", () => {
    expect(Object.keys(pkg.schemas).sort()).toEqual(EVERY);
  });

  test("msgspec names one field however many are wrong, and answers 400", () => {
    expect(judge("body.rejected_all", 400, refused)).toBe(true);
    expect(judge("body.rejected_all", 422, refused)).toBe(false);
  });

  test("a body it could not read carries no extra, and that is a different envelope", () => {
    expect(judge("errors.malformed", 400, truncated)).toBe(true);
    expect(judge("errors.malformed", 400, refused)).toBe(false);
    expect(judge("body.rejected_all", 400, truncated)).toBe(false);
  });

  test("rejects this repository's shared envelope, which Litestar no longer answers", () => {
    expect(judge("body.rejected_all", 400, {
      error: "validation_failed",
      errors: PAIRS.map(([field, rule]) => ({ field, rule })),
    })).toBe(false);
  });
});
