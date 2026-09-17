// rust:axum's error contract, against the envelope it answers today.
//
// The bodies are a worked example of that envelope rather than a restatement of the schema,
// so a schema loosened to accept anything fails here.
import { describe, expect, test } from "vitest";
import { askIn, schemaAt, type Answer } from "@rb/schema";
import pkg from "../src/index.js";

const PAIRS = [["customer_id", "int"], ["status", "string"], ["lines", "array"]] as const;

const judge = (answer: Answer): boolean => {
  const declared = pkg.schemas["body.rejected_all"]!(
    askIn(pkg.target, "body.rejected_all", [422], PAIRS));
  return schemaAt(declared, answer.status)?.safeParse(answer).success ?? false;
};

const answered = (body: unknown): Answer =>
  ({ status: 422, body_class: "json", encoding: "", body });

describe(pkg.target, () => {
  test("declares a schema for every error endpoint", () => {
    expect(Object.keys(pkg.schemas).sort()).toEqual([
      "authorized.denied", "body.rejected_all", "body.rejected_first",
      "errors.malformed", "errors.not_found", "errors.unmatched",
    ]);
  });

  test("accepts the shared validator's envelope, which is what it still answers", () => {
    expect(judge(answered({
      error: "validation_failed",
      errors: PAIRS.map(([field, rule]) => ({ field, rule })),
    }))).toBe(true);
  });

  test("rejects an envelope it does not answer", () => {
    expect(judge(answered({
      type: "about:blank", title: "One or more validation errors occurred.", status: 422,
      errors: { customer_id: ["int"], status: ["string"], lines: ["array"] },
    }))).toBe(false);
  });

  test("rejects its own envelope missing a pair the endpoint declares", () => {
    expect(judge(answered({
      error: "validation_failed",
      errors: [{ field: "customer_id", rule: "int" }],
    }))).toBe(false);
  });
});
