// The pieces every framework's contract is built from.
import { describe, expect, test } from "vitest";
import {
  askIn, byStatus, declaredStatuses, errorEnvelope, fieldErrorMap, pairFound,
  problemDetails, schemaAt, shapeOf, z, type Answer,
} from "../src/index.js";

const PAIRS = [["customer_id", "int"], ["status", "string"]] as const;
const ask = askIn("go:gin", "body.rejected_all", [422], PAIRS);
const answered = (body: unknown, over: Partial<Answer> = {}): Answer =>
  ({ status: 422, body_class: "json", encoding: "", body, ...over });

describe("pairFound", () => {
  const ours = { error: "validation_failed", errors: [{ field: "customer_id", rule: "int" }] };
  const problem = { status: 422, errors: { customer_id: ["int"] } };

  test("finds the pair in both shapes anyone writes", () => {
    expect(pairFound(ours, "customer_id", "int")).toBe(true);
    expect(pairFound(problem, "customer_id", "int")).toBe(true);
  });

  test("does not find a pair nobody reported", () => {
    expect(pairFound(ours, "customer_id", "required")).toBe(false);
    expect(pairFound(problem, "status", "string")).toBe(false);
  });

  test("does not accept the field and the rule from two different entries", () => {
    const split = { errors: { customer_id: ["required"], lines: ["int"] } };
    expect(pairFound(split, "customer_id", "int")).toBe(false);
  });
});

describe("shapeOf", () => {
  test("holds the keys and the types, not values that change per connection", () => {
    const a = { type: "about:blank", status: 422, traceId: "00-a-01" };
    const b = { type: "about:blank", status: 422, traceId: "00-b-02" };
    expect([...shapeOf(a)].sort()).toEqual([...shapeOf(b)].sort());
  });

  test("names the path to a nested value", () => {
    expect([...shapeOf({ errors: { customer_id: ["int"] } })]).toEqual(["errors.customer_id[]:string"]);
  });
});

describe("errorEnvelope", () => {
  const schema = errorEnvelope(ask, z.object({ error: z.string() }).strict());

  test("a body of the declared shape reporting every pair passes", () => {
    const withPairs = errorEnvelope(ask, z.object({
      error: z.string(), errors: z.array(z.object({ field: z.string(), rule: z.string() })),
    }).strict());
    expect(withPairs.safeParse(answered({
      error: "validation_failed",
      errors: PAIRS.map(([field, rule]) => ({ field, rule })),
    })).success).toBe(true);
  });

  test("a status outside the endpoint's own says which was expected", () => {
    const r = schema.safeParse(answered({ error: "x" }, { status: 500 }));
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe("expected 422, got 500");
  });

  test("a body that is not json is not an error envelope however it reads", () => {
    expect(schema.safeParse(answered("<p>no</p>", { body_class: "html" })).success).toBe(false);
  });

  test("a declared pair that is not reported anywhere says which", () => {
    const r = schema.safeParse(answered({ error: "validation_failed" }));
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.message))
      .toEqual(["does not report customer_id=int", "does not report status=string"]);
  });
});

describe("a framework that answers something other than the endpoint's default", () => {
  // What #35 needs. gin's ShouldBindJSON answers 400 where the endpoint declares 422, and
  // go-playground/validator writes its own tag names rather than this repository's rules.
  const binding = z.object({ error: z.string(), fields: z.record(z.string(), z.string()) }).strict();

  test("its declared status is what it is held to, not the endpoint's", () => {
    const schema = errorEnvelope(ask, binding, { statuses: [400] });
    // The endpoint's own rule wording, because overriding the status overrides nothing else.
    const body = { error: "invalid", fields: { customer_id: "int", status: "string" } };
    expect(schema.safeParse(answered(body, { status: 400 })).success).toBe(true);
    expect(schema.safeParse(answered(body, { status: 422 })).success).toBe(false);
  });

  test("its own wording for a rule is what is looked for", () => {
    const schema = errorEnvelope(ask, binding, {
      statuses: [400],
      fieldErrors: [["customer_id", "numeric"], ["status", "alpha"]],
    });
    const right = { error: "invalid", fields: { customer_id: "numeric", status: "alpha" } };
    const wrong = { error: "invalid", fields: { customer_id: "int", status: "string" } };
    expect(schema.safeParse(answered(right, { status: 400 })).success).toBe(true);
    expect(schema.safeParse(answered(wrong, { status: 400 })).success).toBe(false);
  });

  test("dropping the pairs leaves the body schema to name the fields, and it still can", () => {
    const named = z.object({
      error: z.string(),
      fields: z.object({ customer_id: z.string(), status: z.string() }).strict(),
    }).strict();
    const schema = errorEnvelope(ask, named, { statuses: [400], fieldErrors: [] });
    const short = { error: "invalid", fields: { customer_id: "numeric" } };
    expect(schema.safeParse(answered(short, { status: 400 })).success).toBe(false);
  });

  test("a framework whose error body is not json says so", () => {
    const schema = errorEnvelope(ask, z.string(), { statuses: [400], fieldErrors: [], bodyClass: "text" });
    expect(schema.safeParse(answered("customer_id: not a number", { status: 400, body_class: "text" })).success)
      .toBe(true);
    expect(schema.safeParse(answered("customer_id: not a number", { status: 400 })).success).toBe(false);
  });

  test("saying nothing leaves the endpoint's declaration in force", () => {
    const schema = errorEnvelope(ask, z.object({ error: z.string() }).strict());
    expect(schema.safeParse(answered({ error: "x" }, { status: 400 })).success).toBe(false);
  });
});

describe("problemDetails", () => {
  const base = { type: "about:blank", title: "Invalid", status: 422 };

  test("traceId is optional, because tracing decides whether it is there", () => {
    expect(problemDetails().safeParse(base).success).toBe(true);
    expect(problemDetails().safeParse({ ...base, traceId: "00-a-01" }).success).toBe(true);
  });

  test("a key the framework was not declared to send is refused", () => {
    expect(problemDetails().safeParse({ ...base, detail: "extra" }).success).toBe(false);
  });

  test("the validation map is added by the endpoints that carry one", () => {
    const withMap = problemDetails({ errors: fieldErrorMap });
    expect(withMap.safeParse({ ...base, errors: { customer_id: ["int"] } }).success).toBe(true);
    expect(withMap.safeParse({ ...base, errors: { customer_id: [] } }).success).toBe(false);
  });
});

describe("byStatus", () => {
  // Why the map exists: a framework's binder and its validator can fail at different layers,
  // and the status is how it says which. axum answers 400 when the JSON will not parse and
  // 422 when it parses but will not deserialize into T.
  const syntax = z.object({ error: z.string() }).strict();
  const data = z
    .object({ error: z.string(), fields: z.record(z.string(), z.string()) })
    .strict();
  const declared = byStatus(askIn("rust:axum", "errors.malformed", [400, 422]), {
    400: syntax,
    422: { body: data, reports: [["customer_id", "invalid type"]] },
  });

  test("the key is the status, so a branch never restates its own", () => {
    expect(declaredStatuses(declared)).toEqual([400, 422]);
    expect(schemaAt(declared, 400)!.safeParse(
      answered({ error: "expected value at line 1" }, { status: 400 }),
    ).success).toBe(true);
  });

  test("each status is judged by its own envelope, not the other's", () => {
    expect(schemaAt(declared, 400)!.safeParse(
      answered({ error: "x", fields: { customer_id: "invalid type" } }, { status: 400 }),
    ).success).toBe(false);
    expect(schemaAt(declared, 422)!.safeParse(
      answered({ error: "x" }, { status: 422 }),
    ).success).toBe(false);
  });

  test("a branch carries its own field errors, because a parse failure names none", () => {
    expect(schemaAt(declared, 422)!.safeParse(
      answered({ error: "x", fields: { customer_id: "invalid type" } }, { status: 422 }),
    ).success).toBe(true);
    expect(schemaAt(declared, 422)!.safeParse(
      answered({ error: "x", fields: { status: "invalid type" } }, { status: 422 }),
    ).success).toBe(false);
  });

  test("a status the framework never declared resolves to nothing", () => {
    expect(schemaAt(declared, 500)).toBeNull();
  });

  test("a bare schema answers for every status, and declares none", () => {
    const single = errorEnvelope(ask, z.object({ error: z.string() }).strict());
    expect(schemaAt(single, 499)).toBe(single);
    expect(declaredStatuses(single)).toEqual([]);
  });
});
