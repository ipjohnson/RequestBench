// dotnet:wolverine-http's error contract. The interesting one is errors.malformed, where
// the JSON reader's own failure is surfaced rather than replaced.
import { describe, expect, test } from "vitest";
import { askIn, type Answer } from "@rb/schema";
import pkg from "../src/index.js";

const PAIRS = [["customer_id", "int"], ["status", "string"], ["lines", "array"]] as const;

const judge = (
  endpoint: string, statuses: readonly number[],
  pairs: readonly (readonly [string, string])[], body: unknown,
): boolean =>
  pkg.schemas[endpoint]!(askIn(pkg.target, endpoint, statuses, pairs))
    .safeParse({ status: statuses[0], body_class: "json", encoding: "", body } as Answer)
    .success;

describe(pkg.target, () => {
  test("declares a schema for every error endpoint", () => {
    expect(Object.keys(pkg.schemas).sort()).toEqual([
      "authorized.denied", "body.rejected_all", "body.rejected_first",
      "errors.malformed", "errors.not_found", "errors.unmatched",
    ]);
  });

  test("accepts ProblemDetails carrying the validation map", () => {
    expect(judge("body.rejected_all", [422], PAIRS, {
      type: "about:blank", title: "One or more validation errors occurred.", status: 422,
      errors: { customer_id: ["int"], status: ["string"], lines: ["array"] },
    })).toBe(true);
  });

  test("a malformed body reports where the reader stopped", () => {
    expect(judge("errors.malformed", [400, 422], [], {
      type: "about:blank", title: "Bad Request", status: 400,
      detail: "'{' is an invalid start of a property name.",
      instance: "/errors/malformed", lineNumber: 0, bytePositionInLine: 1,
    })).toBe(true);
  });

  test("the reader's diagnostics are required there, not optional decoration", () => {
    expect(judge("errors.malformed", [400, 422], [], {
      type: "about:blank", title: "Bad Request", status: 400,
    })).toBe(false);
  });

  test("and are not accepted on the endpoints that do not carry them", () => {
    expect(judge("errors.not_found", [404], [], {
      type: "about:blank", title: "Not Found", status: 404, lineNumber: 0,
    })).toBe(false);
  });
});
