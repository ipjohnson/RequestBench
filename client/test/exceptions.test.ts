// What each framework says it answers on an error endpoint, and whether it does.
//
// The check that matters is the last one: two frameworks whose envelopes genuinely differ
// are each accepted by their own contract and rejected by the other's. That is the property
// the gate relies on when it stops comparing error bodies against a reference.
import { describe, expect, test } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { bodyClass } from "../src/checks.js";
import { comparable } from "../src/compare.js";
import { declaredExceptions, errorProblem, schemaFor } from "../src/exceptions.js";
import { ROOT, askFor, isError, loadPlan, type PlanEndpoint } from "../src/spec.js";
import type { Answer } from "@rb/schema";

const plan = loadPlan();
const errorEndpoints = plan.endpoints.filter(isError);

type Matrix = {
  languages: Record<string, { implemented: readonly string[] }>;
};
const matrix = JSON.parse(
  readFileSync(join(ROOT, "spec", "matrix.json"), "utf8"),
) as Matrix;
const implemented = Object.entries(matrix.languages)
  .flatMap(([language, v]) => v.implemented.map((f) => `${language}:${f}`))
  .sort();

const firstPath = (ep: PlanEndpoint): string => ep.paths[0] ?? "/";

describe("coverage", () => {
  test("the plan has error endpoints to cover", () => {
    expect(errorEndpoints.map((e) => e.id).sort()).toEqual([
      "authorized.denied", "body.rejected_all", "body.rejected_first",
      "errors.malformed", "errors.not_found", "errors.unmatched",
    ]);
  });

  test("the registry names exactly the implemented targets", () => {
    expect(declaredExceptions().map((p) => p.target).sort()).toEqual(implemented);
  });

  test("every target declares a contract for every error endpoint", () => {
    const missing: string[] = [];
    for (const target of implemented) {
      for (const ep of errorEndpoints) {
        if (!schemaFor(askFor(target, ep, firstPath(ep)))) missing.push(`${target} ${ep.id}`);
      }
    }
    expect(missing).toEqual([]);
  });

  test("each package says why, so the scenario page has something to print", () => {
    for (const p of declaredExceptions()) expect(p.because.length).toBeGreaterThan(40);
  });

  // The review concern with a hand-written schema is that it gets loosened until it accepts
  // whatever the target happens to send, at which point the gate reports a pass and means
  // nothing. A schema built on z.unknown() passes every other test in this file.
  test("no schema accepts a body with none of the framework's own keys in it", () => {
    const accepting: string[] = [];
    for (const target of implemented) {
      for (const ep of errorEndpoints) {
        const ask = askFor(target, ep, firstPath(ep));
        const answer: Answer = {
          status: ask.statuses[0]!, body_class: "json", encoding: "", body: {},
        };
        if (!errorProblem(ask, answer)) accepting.push(`${target} ${ep.id}`);
      }
    }
    expect(accepting).toEqual([]);
  });
});

describe("the committed exemplars", () => {
  // Real captured responses, which is the only end-to-end evidence available without
  // booting a target. Three kinds of file contribute nothing and are skipped: one captured
  // against an older blend, whose endpoint set is not this one; one for a baseline that has
  // since been removed from the matrix; and a body long enough to have been truncated, which
  // is not the whole envelope.
  type Exemplar = {
    endpoint: string;
    response: { status: number; headers: [string, string][]; body: string; truncated: boolean };
  };
  const dir = join(ROOT, "results", "exemplars");
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  const byId = new Map(plan.endpoints.map((e) => [e.id, e]));

  const cases = files.flatMap((file) => {
    const [name] = file.split("@");
    const [language, ...rest] = (name ?? "").split("-");
    const target = `${language}:${rest.join("-")}`;
    if (!implemented.includes(target)) return [];
    const doc = JSON.parse(readFileSync(join(dir, file), "utf8")) as
      { blend: string; endpoints: Exemplar[] };
    if (doc.blend !== plan.version) return [];
    return doc.endpoints
      .filter((e) => !e.response.truncated && isError(byId.get(e.endpoint)!))
      .map((e) => ({ file, target, entry: e }));
  });

  test("there are exemplars to check", () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  test.each(cases)("$file $entry.endpoint", ({ target, entry }) => {
    const ep = byId.get(entry.endpoint)!;
    const headers = new Map(entry.response.headers.map(([k, v]) => [k.toLowerCase(), v]));
    const ctype = headers.get("content-type");
    const answer: Answer = {
      status: entry.response.status,
      body_class: bodyClass(ctype),
      encoding: headers.get("content-encoding") ?? "",
      body: comparable(Buffer.from(entry.response.body, "utf8"), ctype),
    };
    expect(errorProblem(askFor(target, ep, firstPath(ep)), answer)).toBeNull();
  });
});

describe("one framework's envelope against another's contract", () => {
  const rejectedAll = plan.endpoints.find((e) => e.id === "body.rejected_all")!;
  const ask = (target: string) => askFor(target, rejectedAll, firstPath(rejectedAll));
  const answer = (body: unknown): Answer =>
    ({ status: 422, body_class: "json", encoding: "", body });

  // What each framework actually answers, as spec/expected.json recorded its shape.
  const shared = {
    error: "validation_failed",
    errors: [
      { field: "customer_id", rule: "int" },
      { field: "status", rule: "string" },
      { field: "lines", rule: "array" },
    ],
  };
  const problemDetails = {
    type: "https://tools.ietf.org/html/rfc9110#section-15.5.21",
    title: "One or more validation errors occurred.",
    status: 422,
    errors: { customer_id: ["int"], status: ["string"], lines: ["array"] },
  };
  const fastEndpoints = {
    message: "One or more errors occurred!",
    status_code: 422,
    errors: { customer_id: ["int"], status: ["string"], lines: ["array"] },
  };

  test("each is accepted by its own", () => {
    expect(errorProblem(ask("go:gin"), answer(shared))).toBeNull();
    expect(errorProblem(ask("dotnet:aspnet-mvc"), answer(problemDetails))).toBeNull();
    expect(errorProblem(ask("dotnet:fastendpoints"), answer(fastEndpoints))).toBeNull();
  });

  // The reason the gate no longer compares error bodies against a reference. Before this,
  // dotnet:fastendpoints measured after dotnet:aspnet-mvc had its ProblemDetails compared
  // field by field against an ErrorResponse and the difference was reported as drift.
  test("each is rejected by the others", () => {
    expect(errorProblem(ask("dotnet:aspnet-mvc"), answer(fastEndpoints))).not.toBeNull();
    expect(errorProblem(ask("dotnet:fastendpoints"), answer(problemDetails))).not.toBeNull();
    expect(errorProblem(ask("go:gin"), answer(problemDetails))).not.toBeNull();
    expect(errorProblem(ask("dotnet:carter"), answer(shared))).not.toBeNull();
  });

  test("a key the framework never answers fails, so a changed envelope is caught", () => {
    const extra = { ...problemDetails, detail: "something new" };
    expect(errorProblem(ask("dotnet:aspnet-mvc"), answer(extra))).not.toBeNull();
  });

  test("traceId comes and goes with tracing and is not pinned either way", () => {
    const traced = { ...problemDetails, traceId: "00-4bf92f-00f067-01" };
    expect(errorProblem(ask("dotnet:aspnet-mvc"), answer(traced))).toBeNull();
  });

  test("the right envelope missing a declared pair still fails, and says which", () => {
    const short = { ...problemDetails, errors: { customer_id: ["int"] } };
    expect(errorProblem(ask("dotnet:aspnet-mvc"), answer(short)))
      .toContain("does not report status=string");
  });

  test("the right envelope with the wrong status fails", () => {
    const wrong = { ...answer(problemDetails), status: 400 };
    expect(errorProblem(ask("dotnet:aspnet-mvc"), wrong)).toContain("expected 422, got 400");
  });

  test("an html body is not an error envelope however it reads", () => {
    const html = { status: 422, body_class: "html", encoding: "", body: "<p>no</p>" };
    expect(errorProblem(ask("go:gin"), html)).not.toBeNull();
  });

  test("a target with no package fails rather than passing on nothing", () => {
    expect(errorProblem(ask("go:huma"), answer(shared)))
      .toContain("declares no error contract");
  });
});
