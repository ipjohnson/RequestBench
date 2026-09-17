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
import {
  declaredExceptions, errorProblem, problemAgainst, schemaFor,
} from "../src/exceptions.js";
import { ROOT, askFor, isError, loadPlan, type PlanEndpoint } from "../src/spec.js";
import { byStatus, z, type Answer } from "@rb/schema";

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
  // booting a target. Four kinds of file contribute nothing and are skipped: one captured
  // against an older blend, whose endpoint set is not this one; one for a baseline that has
  // since been removed from the matrix; a body long enough to have been truncated, which is
  // not the whole envelope; and an entry for an endpoint the set no longer carries, since a
  // capture taken before a row was renamed says nothing about the row that replaced it.
  type Exemplar = {
    endpoint: string;
    response: { status: number; headers: [string, string][]; body: string; truncated: boolean };
  };
  // An endpoint the plan no longer has answers 200, so isError() drops it the same way it
  // drops every endpoint that was never an error endpoint.
  const NOT_IN_SET = { id: "", family: "", method: "GET", expect: 200, paths: [] };
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
      .filter((e) => !e.response.truncated && isError(byId.get(e.endpoint) ?? NOT_IN_SET))
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

describe("a framework that declares one envelope per status", () => {
  // No framework needs this yet: every one of the 33 fails at a single layer today, so a
  // single schema is the honest declaration. It is here because #35 splits them -- axum's
  // Json<T> answers 400 for JSON that will not parse and 422 for JSON that will not
  // deserialize into T -- and the branch selection should not arrive untested.
  const malformed = plan.endpoints.find((e) => e.id === "errors.malformed")!;
  const ask = askFor("rust:axum", malformed, firstPath(malformed));
  const declared = byStatus(ask, {
    400: z.object({ error: z.string() }).strict(),
    422: z.object({ error: z.string(), fields: z.record(z.string(), z.string()) }).strict(),
  });
  const answer = (status: number, body: unknown): Answer =>
    ({ status, body_class: "json", encoding: "", body });

  test("the branch for the status that arrived is the one applied", () => {
    expect(problemAgainst(declared, ask, answer(400, { error: "expected value" }))).toBeNull();
    expect(problemAgainst(declared, ask, answer(422, {
      error: "invalid type", fields: { customer_id: "expected i64" },
    }))).toBeNull();
  });

  test("the other status's envelope is not accepted in its place", () => {
    expect(problemAgainst(declared, ask, answer(400, {
      error: "invalid type", fields: { customer_id: "expected i64" },
    }))).toBe("body: Unrecognized key(s) in object: 'fields' "
      + "(answered error:string, fields.customer_id:string)");
  });

  test("a status it never declared fails and names the ones it did", () => {
    expect(problemAgainst(declared, ask, answer(500, { error: "boom" })))
      .toBe("answered 500, which rust:axum does not declare for errors.malformed "
        + "(it declares 400, 422; answered error:string)");
  });
});

describe("one framework's envelope against another's contract", () => {
  const rejectedAll = plan.endpoints.find((e) => e.id === "body.rejected_all")!;
  const ask = (target: string) => askFor(target, rejectedAll, firstPath(rejectedAll));
  // 422 is what a target that reads the body as a value answers. A target whose binder
  // refuses it first answers its own status, which is why the .NET cases below pass 400.
  const answer = (body: unknown, status = 422): Answer =>
    ({ status, body_class: "json", encoding: "", body });

  // What each framework actually answers, taken from the running targets.
  // go:chi validates in the handler, so a wrong type is a validation failure it reports in
  // full. go:gin binds first, so the same body never reaches its validator.
  const shared = {
    error: "validation_failed",
    errors: [
      { field: "customer_id", rule: "int" },
      { field: "status", rule: "string" },
      { field: "lines", rule: "array" },
    ],
  };
  // Both .NET targets refuse the plan's body at the binder, before any validator, and both
  // answer 400 -- in envelopes that are nothing like each other.
  const problemDetails = {
    type: "https://tools.ietf.org/html/rfc9110#section-15.5.21",
    title: "One or more validation errors occurred.",
    status: 400,
    errors: { body: ["The body field is required."], "$.customer_id": ["not convertible"] },
  };
  const fastEndpoints = {
    message: "One or more errors occurred!",
    status_code: 400,
    errors: { customer_id: ["Either the JSON value is not in a supported format."] },
  };

  // go:gin answers this only when the body deserialized and then failed a rule.
  const ginRefused = {
    error: "validation_failed",
    fields: { customer_id: "required", status: "required", lines: "required" },
  };

  test("each is accepted by its own", () => {
    expect(errorProblem(ask("go:chi"), answer(shared))).toBeNull();
    expect(errorProblem(ask("go:gin"), answer(ginRefused))).toBeNull();
    expect(errorProblem(ask("dotnet:aspnet-mvc"), answer(problemDetails, 400))).toBeNull();
    expect(errorProblem(ask("dotnet:fastendpoints"), answer(fastEndpoints, 400))).toBeNull();
  });

  // The reason the gate no longer compares error bodies against a reference. Before this,
  // dotnet:fastendpoints measured after dotnet:aspnet-mvc had its ProblemDetails compared
  // field by field against an ErrorResponse and the difference was reported as drift.
  test("each is rejected by the others", () => {
    expect(errorProblem(ask("dotnet:aspnet-mvc"), answer(fastEndpoints, 400))).not.toBeNull();
    expect(errorProblem(ask("dotnet:fastendpoints"), answer(problemDetails, 400))).not.toBeNull();
    expect(errorProblem(ask("go:chi"), answer(problemDetails))).not.toBeNull();
    expect(errorProblem(ask("dotnet:carter"), answer(shared))).not.toBeNull();
    // The two Go styles do not accept each other either, which is what #35 set out to show.
    expect(errorProblem(ask("go:gin"), answer(shared))).not.toBeNull();
    expect(errorProblem(ask("go:chi"), answer(ginRefused))).not.toBeNull();
  });

  test("a key the framework never answers fails, so a changed envelope is caught", () => {
    const extra = { ...problemDetails, detail: "something new" };
    expect(errorProblem(ask("dotnet:aspnet-mvc"), answer(extra))).not.toBeNull();
  });

  test("traceId comes and goes with tracing and is not pinned either way", () => {
    const traced = { ...problemDetails, traceId: "00-4bf92f-00f067-01" };
    expect(errorProblem(ask("dotnet:aspnet-mvc"), answer(traced, 400))).toBeNull();
  });

  // The pairs are only required where the target reports them. MVC reports its own keys --
  // the JSON path, or the CLR property -- so its package drops the endpoint's pairs and the
  // envelope is what holds the shape.
  test("a target that names its own keys is held to the envelope, not to the pairs", () => {
    const short = { ...problemDetails, errors: { "$.customer_id": ["not convertible"] } };
    expect(errorProblem(ask("dotnet:aspnet-mvc"), answer(short, 400))).toBeNull();
    expect(errorProblem(ask("dotnet:aspnet-mvc"), answer({ ...problemDetails, errors: {} }, 400)))
      .not.toBeNull();
  });

  test("the right envelope with a status it does not answer fails", () => {
    expect(errorProblem(ask("dotnet:aspnet-mvc"), answer(problemDetails, 422)))
      .toContain("expected 400, got 422");
  });

  test("an html body is not an error envelope however it reads", () => {
    const html = { status: 422, body_class: "html", encoding: "", body: "<p>no</p>" };
    expect(errorProblem(ask("go:chi"), html)).not.toBeNull();
  });

  test("a target with no package fails rather than passing on nothing", () => {
    expect(errorProblem(ask("go:huma"), answer(shared)))
      .toContain("declares no error contract");
  });
});
