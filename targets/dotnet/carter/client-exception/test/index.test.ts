// dotnet:carter's error contract, against the envelopes ASP.NET Core's problem details
// service produces underneath it.
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

  test("a 403 is ProblemDetails too, unlike MVC's", () => {
    expect(judge("authorized.denied", [403], [], {
      type: "about:blank", title: "Forbidden", status: 403,
    })).toBe(true);
    expect(judge("authorized.denied", [403], [], { status: 403 })).toBe(false);
  });

  test("a body the reader rejected never reaches the validator, so it carries no map", () => {
    expect(judge("errors.malformed", [400, 422], [], {
      type: "about:blank", title: "Bad Request", status: 400,
    })).toBe(true);
    expect(judge("errors.malformed", [400, 422], [], {
      type: "about:blank", title: "Bad Request", status: 400, errors: { $: ["json"] },
    })).toBe(false);
  });

  test("rejects this repository's own envelope, which Carter never answers", () => {
    expect(judge("body.rejected_all", [422], PAIRS, {
      error: "validation_failed", errors: PAIRS.map(([field, rule]) => ({ field, rule })),
    })).toBe(false);
  });
});
