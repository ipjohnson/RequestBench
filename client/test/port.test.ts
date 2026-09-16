// The cases the port is easy to get wrong. The broad check is differential: both
// implementations run against one booted target and their output is diffed.
import { describe, expect, test } from "vitest";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { comparable, firstDifference } from "../src/compare.js";
import { checkHeaders, framing, decoded, advanced } from "../src/checks.js";
import { pairFound, shapeOf } from "@rb/schema";

const buf = (s: string) => Buffer.from(s, "utf8");

describe("comparable", () => {
  test("an empty body is null, not an empty string", () => {
    expect(comparable(buf(""), "application/json")).toBeNull();
  });

  test("a body that will not parse says so rather than throwing", () => {
    expect(comparable(buf('{"a":'), "application/json")).toBe("unparseable-json");
  });

  test("html whitespace at an element boundary goes, inside text it is kept", () => {
    const engineA = "<p>  one   two  </p>\n  <b>x</b>";
    const engineB = "<p>one two</p><b>x</b>";
    expect(comparable(buf(engineA), "text/html")).toBe(comparable(buf(engineB), "text/html"));
  });

  test("a non-breaking space inside text is content, not formatting", () => {
    // Python's \s on bytes is ASCII-only; a JavaScript \s would collapse this and make the
    // two implementations disagree.
    expect(comparable(buf("<p>a b</p>"), "text/html")).toBe("<p>a b</p>");
  });
});

describe("firstDifference", () => {
  test("names the field rather than reporting two digests", () => {
    expect(firstDifference({ a: { b: 1 } }, { a: { b: 2 } })).toBe("response.a.b: 1 vs 2");
  });

  test("int against float is not a difference", () => {
    expect(firstDifference({ n: 18928 }, { n: 18928.0 })).toBeNull();
  });

  test("true is not 1, which is where this is stricter than the Python", () => {
    expect(firstDifference({ in_stock: true }, { in_stock: 1 })).not.toBeNull();
  });

  test("a missing key is reported against the reference", () => {
    expect(firstDifference({}, { a: 1 })).toBe("response.a: missing here, present in the reference");
  });
});

describe("the response contract", () => {
  test("chunked framing is not missing a content-length", () => {
    const h = [["content-type", "application/json"], ["transfer-encoding", "chunked"]] as const;
    expect(framing(h)).toBe("chunked");
    expect(checkHeaders(200, h, buf("{}"))).toEqual([]);
  });

  test("a 201 has to say where the thing was created", () => {
    const h = [["content-type", "application/json"], ["content-length", "2"]] as const;
    expect(checkHeaders(201, h, buf("{}"))).toEqual([
      "missing location (a 201 must say where the thing was created)",
    ]);
  });

  test("a declared length that is not the body's length is a problem", () => {
    const h = [["content-type", "application/json"], ["content-length", "99"]] as const;
    expect(checkHeaders(200, h, buf("{}"))).toContain("content-length 99 but body is 2 bytes");
  });

  test("a 304 owes neither a type nor a length", () => {
    expect(checkHeaders(304, [], Buffer.alloc(0))).toEqual([]);
  });

  test("the lambda host is not asked to declare a length it does not set", () => {
    const h = [["content-type", "application/json"]] as const;
    expect(checkHeaders(200, h, buf("{}"), "lambda")).toEqual([]);
  });

  test("a repeated counter is a response the handler did not produce", () => {
    const h = [["x-rb-serial", "7"]] as const;
    expect(advanced(h, 7)).toBe("x-rb-serial did not advance (7 after 7)");
    expect(advanced(h, 6)).toBeNull();
    expect(advanced([], null)).toMatch(/no x-rb-serial/);
  });

  test("gzip is undone before comparison, and a body that is not gzip survives", () => {
    const h = [["content-encoding", "gzip"]] as const;
    expect(decoded(buf("not gzip at all"), h).toString()).toBe("not gzip at all");
  });
});

describe("error envelopes", () => {
  // This repository's own shape.
  const ours = { error: "validation_failed", errors: [{ field: "customer_id", rule: "int" }] };
  // ASP.NET's ProblemDetails, where the field is a key and the rule lives in its subtree.
  const problem = {
    type: "about:blank", title: "One or more validation errors occurred.", status: 422,
    traceId: "00-abc-01", errors: { customer_id: ["int"] },
  };

  test("both shapes report the pair", () => {
    expect(pairFound(ours, "customer_id", "int")).toBe(true);
    expect(pairFound(problem, "customer_id", "int")).toBe(true);
  });

  test("a pair nobody reported is not found", () => {
    expect(pairFound(ours, "customer_id", "required")).toBe(false);
    expect(pairFound(problem, "status", "string")).toBe(false);
  });

  test("the shape holds the keys and types, not the values that change per connection", () => {
    const withTrace = { ...problem, traceId: "00-def-02" };
    expect([...shapeOf(problem)].sort()).toEqual([...shapeOf(withTrace)].sort());
    expect([...shapeOf(problem)].sort()).toContain("errors.customer_id[]:string");
  });

});

describe("argument validation", () => {
  // argparse rejects these; a cast to the union type only pretends to. --encoding banana
  // used to run the whole plan against the plain-HTTP transport without saying anything.
  const run = (args: string[]) =>
    spawnSync(process.execPath, [join(import.meta.dirname, "..", "dist", "cli.js"), ...args],
              { encoding: "utf8" });

  test("an encoding that is not a choice is refused", () => {
    const r = run(["127.0.0.1:9", "--target", "go:gin", "--encoding", "banana"]);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("invalid choice: 'banana'");
  });

  test("an instance count that is not an integer is refused", () => {
    const r = run(["127.0.0.1:9", "--target", "go:gin", "--instances", "abc"]);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("invalid int value: 'abc'");
  });

  test("a run without a target is refused rather than gated on a guess", () => {
    const r = run(["127.0.0.1:9"]);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("required: --target");
  });
});
