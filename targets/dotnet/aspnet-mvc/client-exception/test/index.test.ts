// dotnet:aspnet-mvc's error contract, against the envelopes MVC actually produces.
//
// The bodies are worked examples rather than a restatement of the schema, so a schema
// loosened to accept anything fails here.
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

const problem = {
  type: "https://tools.ietf.org/html/rfc9110#section-15.5.21",
  title: "One or more validation errors occurred.",
  status: 422,
  errors: { customer_id: ["int"], status: ["string"], lines: ["array"] },
};

describe(pkg.target, () => {
  test("declares a schema for every error endpoint", () => {
    expect(Object.keys(pkg.schemas).sort()).toEqual([
      "authorized.denied", "body.rejected_all", "body.rejected_first",
      "errors.malformed", "errors.not_found", "errors.unmatched",
    ]);
  });

  test("accepts the ProblemDetails a failed model state produces", () => {
    expect(judge("body.rejected_all", [422], PAIRS, problem)).toBe(true);
  });

  test("traceId comes and goes with tracing and is pinned neither way", () => {
    expect(judge("body.rejected_all", [422], PAIRS, { ...problem, traceId: "00-4bf-01" }))
      .toBe(true);
  });

  test("rejects the FastEndpoints envelope", () => {
    expect(judge("body.rejected_all", [422], PAIRS, {
      message: "One or more errors occurred!", status_code: 422, errors: problem.errors,
    })).toBe(false);
  });

  test("rejects this repository's own envelope, which MVC never answers", () => {
    expect(judge("body.rejected_all", [422], PAIRS, {
      error: "validation_failed", errors: PAIRS.map(([field, rule]) => ({ field, rule })),
    })).toBe(false);
  });

  test("a 403 carries the status alone, because the filter runs before the factory", () => {
    expect(judge("authorized.denied", [403], [], { status: 403 })).toBe(true);
    expect(judge("authorized.denied", [403], [], { type: "about:blank", title: "F", status: 403 }))
      .toBe(false);
  });

  test("a body the reader could not parse is reported against the document root", () => {
    expect(judge("errors.malformed", [400, 422], [], {
      type: "about:blank", title: "One or more validation errors occurred.", status: 400,
      traceId: "00-4bf-01", errors: { $: ["The JSON value could not be converted."] },
    })).toBe(true);
  });

  test("rejects a ProblemDetails that grew a key MVC does not send", () => {
    expect(judge("errors.not_found", [404], [], {
      type: "about:blank", title: "Not Found", status: 404, detail: "no such order",
    })).toBe(false);
  });
});
