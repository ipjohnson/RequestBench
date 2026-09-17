// dotnet:fastendpoints' error contract, against the envelopes the framework produces.
//
// Two of them, and the test is here partly to keep the difference visible: the validator's
// ErrorResponse spells the field status_code, and SendForbidden spells it statusCode.
import { describe, expect, test } from "vitest";
import { askIn, schemaAt, type Answer } from "@rb/schema";
import pkg from "../src/index.js";

const PAIRS = [["customer_id", "int"], ["status", "string"], ["lines", "array"]] as const;

const judge = (
  endpoint: string, statuses: readonly number[],
  pairs: readonly (readonly [string, string])[], body: unknown,
): boolean => {
  const answer = { status: statuses[0]!, body_class: "json", encoding: "", body } as Answer;
  const declared = pkg.schemas[endpoint]!(askIn(pkg.target, endpoint, statuses, pairs));
  return schemaAt(declared, answer.status)?.safeParse(answer).success ?? false;
};

const errorResponse = {
  message: "One or more errors occurred!",
  status_code: 422,
  errors: { customer_id: ["int"], status: ["string"], lines: ["array"] },
};

describe(pkg.target, () => {
  test("declares a schema for every error endpoint", () => {
    expect(Object.keys(pkg.schemas).sort()).toEqual([
      "authorized.denied", "body.rejected_all", "body.rejected_first",
      "errors.malformed", "errors.not_found", "errors.unmatched",
    ]);
  });

  test("accepts the ErrorResponse a failed validator produces", () => {
    expect(judge("body.rejected_all", [422], PAIRS, errorResponse)).toBe(true);
  });

  test("rejects ProblemDetails, which this framework does not answer", () => {
    expect(judge("body.rejected_all", [422], PAIRS, {
      type: "about:blank", title: "Invalid", status: 422, errors: errorResponse.errors,
    })).toBe(false);
  });

  test("SendForbidden and SendNotFound spell the field statusCode, not status_code", () => {
    expect(judge("authorized.denied", [403], [], { message: "Forbidden", statusCode: 403 }))
      .toBe(true);
    expect(judge("authorized.denied", [403], [], { message: "Forbidden", status_code: 403 }))
      .toBe(false);
  });

  test("an unclaimed route never reaches the framework, so the host's 404 answers it", () => {
    expect(judge("errors.unmatched", [404], [], { error: "not_found" })).toBe(true);
    expect(judge("errors.unmatched", [404], [], { message: "Not Found", statusCode: 404 }))
      .toBe(false);
  });

  test("a body the binder could not read is a validation failure like any other", () => {
    expect(judge("errors.malformed", [400, 422], [], {
      message: "One or more errors occurred!", status_code: 422,
      errors: { body: ["The request body is invalid."] },
    })).toBe(true);
  });
});
