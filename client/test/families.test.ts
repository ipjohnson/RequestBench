// A host that handles a family in front of the target is not asked for it. A name the plan
// does not have is refused rather than skipped, because skipping it would check everything.
import { describe, expect, test } from "vitest";
import { withoutFamilies, type Plan } from "../src/spec.js";

const plan: Plan = {
  version: "blend-v2",
  instances: 1,
  endpoints: [
    { id: "json.small", family: "json", method: "GET", expect: 200, paths: ["/json/small"] },
    { id: "compressed.identity_large", family: "compressed", method: "GET", expect: 200,
      paths: ["/compressed/large"] },
    { id: "compressed.gzip_large", family: "compressed", method: "GET", expect: 200,
      paths: ["/compressed/large"] },
  ],
};

describe("withoutFamilies", () => {
  test("drops every endpoint in a named family and keeps the rest", () => {
    expect(withoutFamilies(plan, ["compressed"]).endpoints.map((ep) => ep.id))
      .toEqual(["json.small"]);
  });

  test("returns the plan itself when no family is named", () => {
    expect(withoutFamilies(plan, [])).toBe(plan);
  });

  test("refuses a family the plan does not have", () => {
    expect(() => withoutFamilies(plan, ["compresed"]))
      .toThrow("no such family in the plan: compresed");
  });
});
