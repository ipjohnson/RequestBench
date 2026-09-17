// node:fastify's error contract, against the bodies it actually sends.
//
// The bodies here were taken from the running target. The code field is what carries the
// distinction Fastify draws, so a parse failure must not be accepted where a schema failure
// is declared, or the other way round.
import { describe, expect, test } from "vitest";
import { askIn, schemaAt, type Answer } from "@rb/schema";
import pkg from "../src/index.js";

const PAIRS = [["customer_id", "int"], ["status", "string"], ["lines", "array"]] as const;

const judge = (endpoint: string, status: number, body: unknown): boolean => {
  const answer = { status, body_class: "json", encoding: "", body } as Answer;
  const declared = pkg.schemas[endpoint]!(askIn(pkg.target, endpoint, [status], PAIRS));
  return schemaAt(declared, status)?.safeParse(answer).success ?? false;
};

// ajv refused the body. Note the 400: to Fastify a wrong type is a schema violation.
const schemaFailed = {
  statusCode: 400, code: "FST_ERR_VALIDATION", error: "Bad Request",
  message: "body/customer_id must be integer",
};
// The parser could not read it, so no schema ran.
const parseFailed = {
  statusCode: 400, code: "FST_ERR_CTP_INVALID_JSON", error: "Bad Request",
  message: "Unexpected end of JSON input",
};

describe(pkg.target, () => {
  // rb:test authorized.denied,body.rejected_all,body.rejected_first,errors.not_found,errors.unmatched,errors.malformed
  test("declares a schema for every error endpoint", () => {
    expect(Object.keys(pkg.schemas).sort()).toEqual([
      "authorized.denied", "body.rejected_all", "body.rejected_first",
      "errors.malformed", "errors.not_found", "errors.unmatched",
    ]);
  });

  // rb:test body.rejected_all
  test("a schema failure is 400, because ajv treats a wrong type as one", () => {
    expect(judge("body.rejected_all", 400, schemaFailed)).toBe(true);
    expect(judge("body.rejected_all", 422, schemaFailed)).toBe(false);
  });

  // rb:test body.rejected_all,errors.malformed
  test("the code is what separates the two layers, and it is not interchangeable", () => {
    expect(judge("errors.malformed", 400, parseFailed)).toBe(true);
    expect(judge("errors.malformed", 400, schemaFailed)).toBe(false);
    expect(judge("body.rejected_all", 400, parseFailed)).toBe(false);
  });

  // rb:test body.rejected_all
  test("rejects this repository's shared envelope, which Fastify no longer answers", () => {
    expect(judge("body.rejected_all", 400, {
      error: "validation_failed",
      errors: PAIRS.map(([field, rule]) => ({ field, rule })),
    })).toBe(false);
  });

  // rb:test body.rejected_all
  test("rejects a Fastify envelope that grew a key", () => {
    expect(judge("body.rejected_all", 400, { ...schemaFailed, validation: [] })).toBe(false);
  });
});
