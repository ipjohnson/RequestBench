// dotnet:minimal-apis' error contract, against what Results.Problem and
// Results.ValidationProblem produce.
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

  test("accepts what Results.ValidationProblem writes", () => {
    expect(judge("body.rejected_all", [422], PAIRS, {
      type: "about:blank", title: "One or more validation errors occurred.", status: 422,
      errors: { customer_id: ["int"], status: ["string"], lines: ["array"] },
    })).toBe(true);
  });

  test("the first-error endpoint reports one pair and is still the same envelope", () => {
    expect(judge("body.rejected_first", [422], [["customer_id", "int"]], {
      type: "about:blank", title: "One or more validation errors occurred.", status: 422,
      errors: { customer_id: ["int"] },
    })).toBe(true);
  });

  test("a body the reader rejected never reaches the validator, so it carries no map", () => {
    expect(judge("errors.malformed", [400, 422], [], {
      type: "about:blank", title: "Bad Request", status: 400,
    })).toBe(true);
  });

  test("rejects the FastEndpoints envelope", () => {
    expect(judge("body.rejected_all", [422], PAIRS, {
      message: "One or more errors occurred!", status_code: 422,
      errors: { customer_id: ["int"], status: ["string"], lines: ["array"] },
    })).toBe(false);
  });
});
