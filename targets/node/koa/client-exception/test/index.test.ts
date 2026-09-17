// node:koa's error contract, against the bodies it actually sends.
//
// The bodies here were taken from the running target. The first-error case is the one worth
// keeping: this target reads the body as a value, so it can stop after one field, which
// node:fastify cannot.
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

  test("accepts the envelope its own walk produces, with every field named", () => {
    expect(judge("body.rejected_all", 422, refused)).toBe(true);
  });

  test("the first-error row reports one field, and that is still this envelope", () => {
    const one = { error: "validation_failed", errors: [refused.errors[0]] };
    expect(judge("body.rejected_first", 422, one, [["customer_id", "int"]])).toBe(true);
  });

  test("the endpoint's own pairs still apply, because this target reports them", () => {
    const short = { error: "validation_failed", errors: [refused.errors[0]] };
    expect(judge("body.rejected_all", 422, short)).toBe(false);
  });

  test("rejects the envelope Fastify answers", () => {
    expect(judge("body.rejected_all", 422, {
      statusCode: 400, code: "FST_ERR_VALIDATION", error: "Bad Request",
      message: "body/customer_id must be integer",
    })).toBe(false);
  });

  test("a body that is not JSON never reaches the walk, so it is 400 naming no field", () => {
    expect(judge("errors.malformed", 400, {
      error: "invalid_body", detail: "Unexpected end of JSON input",
    })).toBe(true);
    expect(judge("errors.malformed", 400, refused)).toBe(false);
    expect(judge("errors.malformed", 422, refused)).toBe(false);
  });
});
