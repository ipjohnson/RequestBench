// The OpenAPI document every framework implements: every request the corpus sends,
// what a correct answer to each one is, and the committed payload each answer is.
//
// Only the header is written by hand. Everything else comes from running every test's
// closure through the recording client, so the document cannot describe a route or an
// answer the corpus does not check. The four statuses a framework declares in its
// client-exception are written as 4XX and named by field, so one document serves every
// framework.
import { createHash } from "node:crypto";
import { posix } from "node:path";
import { z } from "zod";

import suite from "@rb/tests";
import type { Method, Payload, RunValues, Test } from "@rb/tests/kit";
import { runValues } from "@rb/tests/models/parameters";
import { LARGE } from "@rb/tests/models/payload";
import * as published from "@rb/tests/payloads";
import { tracked } from "./discover.ts";
import { ETAG, placeholders, recorder, type Assert, type RecordedCall, type Recording } from "./record.ts";
import { fileOf, loadSnapshots, type Snapshot } from "./snapshots.ts";

type Obj = Record<string, unknown>;

/** One call a test made outside `once`. */
interface Sent {
  readonly id: string;
  readonly test: Test;
  readonly call: RecordedCall;
  readonly recording: Recording;
}

/** What the document is built from. */
export interface Corpus {
  readonly sent: readonly Sent[];
  /** Every zod schema tests/models exports, by its export name, which is its name under components. */
  readonly models: ReadonlyMap<z.ZodType, string>;
  /** Every payload tests/payloads exports, by its value, which is how a request body is traced to its payload. */
  readonly payloads: ReadonlyMap<unknown, Payload>;
  readonly snapshots: ReadonlyMap<string, Snapshot>;
  readonly files: ReadonlySet<string>;
}

const FORMATS = new Set(["json", "lines", "text", "html"]);

const isPayload = (v: unknown): v is Payload =>
  v !== null && typeof v === "object" && typeof (v as Payload).name === "string" && FORMATS.has((v as Payload).format) && "value" in v;

export async function corpus(root: string): Promise<Corpus> {
  const files = new Set(tracked(root));

  const models = new Map<z.ZodType, string>();
  for (const path of [...files].sort()) {
    const m = /^tests\/models\/([\w-]+)\.ts$/.exec(path);
    if (m === null) continue;
    const module = (await import(`@rb/tests/models/${m[1]}`)) as Obj;
    for (const [name, value] of Object.entries(module)) {
      if (!(value instanceof z.ZodType)) continue;
      if ([...models.values()].includes(name)) throw new Error(`two files in tests/models export ${name}`);
      models.set(value, name);
    }
  }

  const payloads = new Map<unknown, Payload>();
  const walk = (v: unknown): void => {
    if (isPayload(v)) payloads.set(v.value, v);
    else if (v !== null && typeof v === "object") for (const x of Object.values(v)) walk(x);
  };
  walk(published);

  const sent: Sent[] = [];
  const ids = Object.keys(suite.tests).sort();
  for (const id of ids) {
    const test = suite.tests[id]!;
    const { client, recording } = recorder();
    await test.request(client);
    for (const call of recording.calls) if (!call.priming) sent.push({ id, test, call, recording });
  }

  return { sent, models, payloads, snapshots: loadSnapshots(root, ids), files };
}

/** Beside the registry every framework is added to. */
export const DOCUMENT = "frameworks/openapi.json";

/** A status a response is keyed by. `4XX` is one a framework declares, and `default` is any. */
type Status = number | "4XX" | "default";

export function render(document: Obj): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}

const REF = "#/components/schemas/";

/**
 * JSON Schema for the models and for anything built from them. A model is always a
 * reference, and `components` holds every model a reference reaches.
 */
function schemaSet(models: ReadonlyMap<z.ZodType, string>) {
  const registry = z.registry<{ id: string }>();
  for (const [schema, id] of models) registry.add(schema, { id });
  const ids = new Set(models.values());
  const used = new Set<string>();

  // zod writes a model nested in one schema under $defs, and a model nested in another
  // model under whatever `uri` says. Both become a reference into components.
  const relink = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(relink);
    if (v === null || typeof v !== "object") return v;
    const out: Obj = {};
    for (const [key, x] of Object.entries(v)) {
      if (key === "$ref" && typeof x === "string") {
        const id = /^#\/(?:\$defs|components\/schemas)\/(.+)$/.exec(x)?.[1];
        if (id === undefined || !ids.has(id)) throw new Error(`a schema refers to ${x}, which is not a model`);
        used.add(id);
        out[key] = REF + id;
      } else out[key] = relink(x);
    }
    return out;
  };

  function of(schema: z.ZodType): Obj {
    const id = models.get(schema);
    if (id !== undefined) {
      used.add(id);
      return { $ref: REF + id };
    }
    const { $schema: _s, $defs: _d, ...rest } = z.toJSONSchema(schema, { metadata: registry }) as Obj;
    return relink(rest) as Obj;
  }

  function components(): Obj {
    const all = (z.toJSONSchema(registry, { uri: (id) => REF + id }) as { schemas: Record<string, Obj> }).schemas;
    const out: Obj = {};
    for (let grew = true; grew; ) {
      grew = false;
      for (const id of [...used]) {
        if (Object.hasOwn(out, id)) continue;
        const { $schema: _s, $id: _i, ...body } = all[id]!;
        out[id] = relink(body);
        grew = true;
      }
    }
    return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
  }

  return { of, components };
}

/** A draw that fills a path segment, by the name its tests give it. A run value keeps its own. */
const PATH_NAMES: Readonly<Record<string, string>> = { "draw.item": "id" };

const nameOf = (placeholder: string) => PATH_NAMES[placeholder] ?? placeholder.replace(/^(?:run|draw)\./, "");

const PLACEHOLDER = /\{((?:run|draw)\.\w+)\}/g;

/** The OpenAPI path a call went to: every placeholder a path parameter, and no query. */
const routeOf = (call: RecordedCall) => placeholders(call.path).replace(PLACEHOLDER, (_, p: string) => `{${nameOf(p)}}`);

/** The run value a whole string stands for. */
function runValueOf(text: string): keyof RunValues | undefined {
  const m = /^\{run\.(\w+)\}$/.exec(placeholders(text));
  return m === null ? undefined : (m[1] as keyof RunValues);
}

const echoOf = (call: RecordedCall): ReadonlySet<string> =>
  new Set(call.asserts.flatMap((a) => (a.kind === "bodyIs" ? (a.options.echo ?? []) : [])));

const list = (xs: readonly string[], word: string) =>
  xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} ${word} ${xs.at(-1)!}`;

const code = (s: string) => `\`${s}\``;

const BY_FORMAT: Readonly<Record<Payload["format"], string>> = {
  json: "application/json",
  lines: "application/x-ndjson",
  text: "text/plain",
  html: "text/html",
};

const COMPARED: Readonly<Record<Payload["format"], string>> = {
  json: "Compared as parsed JSON, so key order and how a number is written do not matter.",
  lines: "Compared line by line, each line as parsed JSON.",
  text: "Compared byte for byte.",
  html: "Compared with whitespace at element boundaries removed and every other run of whitespace collapsed to one space.",
};

/** The media type a content-type check names, or the one the payload's format implies. */
function mediaType(format: Payload["format"], match: string | RegExp | undefined): string {
  if (match !== undefined) {
    const named = typeof match === "string" ? match.split(";")[0]!.trim() : match.source.replace(/^\^/, "").replace(/\\\//g, "/");
    if (/^[\w.+-]+\/[\w.+-]+$/.test(named)) return named;
  }
  return BY_FORMAT[format];
}

const describeMatch = (m: string | RegExp | undefined) =>
  m === undefined ? "is present" : typeof m === "string" ? `is ${code(m)}` : `matches ${code(String(m))}`;

const METHODS: readonly Method[] = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];

/** The statuses one call's assertions allow, or `default` when they allow any. */
function statusesOf(asserts: readonly Assert[]): readonly Status[] {
  const found: Status[][] = [];
  for (const a of asserts) {
    if (a.kind === "status") found.push([...a.codes]);
    else if (a.kind === "ok") found.push([200]);
    else if (a.kind === "notModified") found.push([304]);
    else if (a.kind === "notFound" || a.kind === "wrongMethod" || a.kind === "rejected" || a.kind === "unparseable") found.push(["4XX"]);
  }
  if (found.length > 1) throw new Error("a call declares its status twice");
  return found[0] ?? ["default"];
}

/** Explicit codes in order, a range after the codes it covers, and `default` last. */
const rank = (s: Status) => (typeof s === "number" ? s : s === "default" ? 1000 : 499.5);

const failing = (s: Status) => s === "4XX" || (typeof s === "number" && s >= 400);

interface Operation {
  readonly method: Method;
  readonly route: string;
  readonly sent: Sent[];
}

interface Unrouted {
  readonly route: string;
  readonly sent: Sent;
  /** `path` when no route matches the path, `method` when the path has routes and none for this method. */
  readonly miss: "path" | "method";
}

/**
 * Every call as the operation it reaches. A call refused as not found at a literal path
 * belongs to the templated route that matches it, because that route's handler is what
 * refuses it. One that matches no route, and one sent with a method its path has no
 * route for, reach no operation.
 */
function operations(sent: readonly Sent[]): { ops: Operation[]; unrouted: Unrouted[] } {
  const ops = new Map<string, Operation>();
  const refusedAt = (s: Sent) => s.call.asserts.some((a) => a.kind === "notFound") && routeOf(s.call) === s.call.path;
  const wrongMethod = (s: Sent) => s.call.asserts.some((a) => a.kind === "wrongMethod");

  for (const s of sent) {
    if (refusedAt(s) || wrongMethod(s)) continue;
    const key = `${s.call.method} ${routeOf(s.call)}`;
    const op = ops.get(key) ?? { method: s.call.method, route: routeOf(s.call), sent: [] };
    op.sent.push(s);
    ops.set(key, op);
  }

  const matches = (route: string, path: string) =>
    new RegExp(`^${route.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\\?\{\w+\\?\}/g, "[^/]+")}$`).test(path);
  const unrouted: Unrouted[] = [];

  for (const s of sent) {
    if (wrongMethod(s)) {
      const route = routeOf(s.call);
      if (ops.has(`${s.call.method} ${route}`)) throw new Error(`${s.id} expects no ${s.call.method} route at ${route}, and another test uses one`);
      unrouted.push({ route, sent: s, miss: "method" });
    } else if (refusedAt(s)) {
      const same = [...ops.values()].filter((op) => op.method === s.call.method);
      const op = same.find((o) => o.route === s.call.path) ?? same.find((o) => matches(o.route, s.call.path));
      if (op === undefined) unrouted.push({ route: s.call.path, sent: s, miss: "path" });
      else op.sent.push(s);
    }
  }

  return { ops: [...ops.values()], unrouted };
}

export function openapi(c: Corpus): Obj {
  const directory = posix.dirname(DOCUMENT);
  const schemas = schemaSet(c.models);

  /** The committed file a payload is: items.large is items.large.json, and a text payload is named for its file. */
  const fileFor = (p: Payload): string | undefined =>
    (p.from ?? []).length > 0 ? undefined : [`tests/payloads/${p.name}`, `tests/payloads/${p.name}.json`].find((f) => c.files.has(f));

  /** A payload's name with any sentinel in it put back as its placeholder, the way the path shows it. */
  const shown = (p: Payload) => placeholders(p.name).replace(PLACEHOLDER, (_, ph: string) => `{${nameOf(ph)}}`);

  /** What an example says about a payload with no file: what it is computed from, or that it is a literal. */
  const source = (p: Payload) => {
    const from = (p.from ?? []).map((q) => code(q.name));
    if (from.length > 0) return `Computed from ${list(from, "and")}, with no file of its own.`;
    return fileFor(p) === undefined ? "A literal, with no file." : "";
  };

  /** An Example Object that names a payload and links its file when it has one. The value is never copied in. */
  function example(p: Payload, extra: string, compared: boolean): Obj {
    const file = fileFor(p);
    const description = [source(p), compared ? COMPARED[p.format] : "", extra].filter((d) => d !== "").join(" ");
    return {
      summary: shown(p),
      ...(description === "" ? {} : { description }),
      ...(file === undefined ? {} : { externalValue: posix.relative(directory, file) }),
    };
  }

  /** The snapshot holding each framework's own answer to a row, named rather than copied in. */
  const captured = (s: Sent) =>
    c.snapshots.has(s.id) ? ` ${fileOf(s.id, ".snap.json")} holds the answer each framework was captured giving.` : "";

  /** The schema of a payload as an answer carries it, with the echo beside its own fields. */
  function bodySchema(p: Payload, echo: readonly (keyof RunValues)[]): Obj | undefined {
    if (p.format !== "json") return { type: "string" };
    if (p.model === undefined) return undefined;
    const model = p.model as unknown as z.ZodType;
    if (echo.length === 0) return schemas.of(model);
    if (!(model instanceof z.ZodObject)) throw new Error(`${p.name} carries an echo, and its model is not an object`);
    const shape = Object.fromEntries(echo.map((k) => [k, runValues[k].schema]));
    return schemas.of(model.extend({ echo: z.strictObject(shape) }));
  }

  const oneOf = (all: readonly Obj[]): Obj | undefined => {
    const distinct = [...new Map(all.map((s) => [JSON.stringify(s), s])).values()];
    return distinct.length <= 1 ? distinct[0] : { oneOf: distinct };
  };

  const runDescription = (key: string, echoed: boolean, param?: string) =>
    `Drawn once per run and never given to the framework.${echoed ? ` The answer echoes it${param === undefined || param === key ? "" : ` as ${key}`}.` : ""}`;

  function pathParameter(placeholder: string, echoed: boolean): Obj {
    const name = nameOf(placeholder);
    if (placeholder === "draw.item") {
      return {
        name,
        in: "path",
        required: true,
        description: `A row of items.large, drawn per request from 1 to ${LARGE}.`,
        schema: { type: "integer", minimum: 1 },
      };
    }
    const key = placeholder.replace(/^run\./, "") as keyof RunValues;
    if (!placeholder.startsWith("run.") || !(key in runValues)) throw new Error(`no schema for the path parameter {${placeholder}}`);
    return { name, in: "path", required: true, description: runDescription(key, echoed), schema: schemas.of(runValues[key].schema) };
  }

  const valueSchema = (value: string): Obj => {
    const key = runValueOf(value);
    return key === undefined ? { type: "string", const: value } : schemas.of(runValues[key].schema);
  };

  /** A form field's schema, described the way a query parameter carrying the same run value is. */
  const fieldSchema = (s: Sent, name: string, value: string): Obj => {
    const key = runValueOf(value);
    return key === undefined ? valueSchema(value) : { ...valueSchema(value), description: runDescription(key, echoOf(s.call).has(key), name) };
  };

  /** Every header a call sends that is not bound to a parameter, as the description shows it. */
  function otherHeaders(s: Sent): string[] {
    const echo = echoOf(s.call);
    return s.call.headers
      .filter(([, v]) => !echo.has(runValueOf(v) ?? ""))
      .map(([name, v]) => {
        if (v === ETAG) return `${code(name)} set to the etag the first GET answered`;
        const choice = s.recording.choices.find((values) => String(values[0]) === v);
        if (choice !== undefined) return `${code(name)} set per request to ${list(choice.map((v) => code(String(v))), "or")}`;
        return code(`${name}: ${placeholders(v)}`);
      });
  }

  function parameters(op: Operation): Obj[] {
    const defining = op.sent.filter((s) => routeOf(s.call) === op.route && !s.call.asserts.some((a) => a.kind === "notFound"));
    const out: Obj[] = [];

    const first = op.sent.find((s) => routeOf(s.call) === op.route) ?? op.sent[0]!;
    for (const m of placeholders(first.call.path).matchAll(PLACEHOLDER)) {
      const placeholder = m[1]!;
      const echoed = op.sent.some((s) => echoOf(s.call).has(placeholder.replace(/^run\./, "")));
      out.push(pathParameter(placeholder, echoed));
    }

    const query = new Map<string, { value: string; count: number; echoed: boolean }>();
    for (const s of defining) {
      for (const [name, value] of s.call.query) {
        const had = query.get(name);
        const echoed = echoOf(s.call).has(runValueOf(value) ?? "");
        query.set(name, { value, count: (had?.count ?? 0) + 1, echoed: (had?.echoed ?? false) || echoed });
      }
    }
    for (const [name, q] of query) {
      const key = runValueOf(q.value);
      out.push({
        name,
        in: "query",
        required: q.count === defining.length,
        ...(key === undefined ? {} : { description: runDescription(key, q.echoed, name) }),
        schema: valueSchema(q.value),
      });
    }

    const headers = new Map<string, { value: string; count: number }>();
    for (const s of defining) {
      const echo = echoOf(s.call);
      for (const [name, value] of s.call.headers) {
        if (!echo.has(runValueOf(value) ?? "")) continue;
        headers.set(name, { value, count: (headers.get(name)?.count ?? 0) + 1 });
      }
    }
    for (const [name, h] of headers) {
      const key = runValueOf(h.value)!;
      out.push({ name, in: "header", required: h.count === defining.length, description: runDescription(key, true, name), schema: valueSchema(h.value) });
    }
    return out;
  }

  /** The parts of a multipart body, in order. */
  function parts(body: string, type: string) {
    const boundary = /boundary=([^;]+)/.exec(type)?.[1];
    if (boundary === undefined) throw new Error(`a multipart body declares no boundary: ${type}`);
    return body
      .split(`--${boundary}`)
      .slice(1, -1)
      .map((chunk) => {
        const split = chunk.indexOf("\r\n\r\n");
        const head = chunk.slice(0, split);
        return {
          name: /name="([^"]*)"/.exec(head)?.[1] ?? "",
          filename: /filename="([^"]*)"/.exec(head)?.[1],
          type: /content-type:\s*([^\r\n;]+)/i.exec(head)?.[1],
          content: chunk.slice(split + 4, -2),
        };
      });
  }

  function requestBody(op: Operation): Obj | undefined {
    const bodies = op.sent.filter((s) => s.call.body !== undefined || s.call.raw !== undefined);
    if (bodies.length === 0) return undefined;
    const content: Record<string, Obj> = {};

    const json = { schemas: [] as Obj[], examples: new Map<string, { payload: Payload; sent: Sent[] }>() };
    for (const s of bodies) {
      const refused = s.call.asserts.some((a) => a.kind === "rejected" || a.kind === "unparseable");
      if (s.call.body !== undefined) {
        const p = c.payloads.get(s.call.body);
        if (p === undefined) throw new Error(`${s.id} sends a JSON body that is not a published payload`);
        const schema = refused ? undefined : bodySchema(p, []);
        if (schema !== undefined) json.schemas.push(schema);
        const had = json.examples.get(p.name);
        json.examples.set(p.name, { payload: p, sent: [...(had?.sent ?? []), s] });
      } else if (s.call.rawType !== undefined) {
        const type = s.call.rawType.split(";")[0]!.trim();
        const properties: Obj = {};
        const encoding: Obj = {};
        if (type === "application/x-www-form-urlencoded") {
          for (const [name, value] of new URLSearchParams(s.call.raw)) properties[name] = fieldSchema(s, name, value);
        } else if (type === "multipart/form-data") {
          for (const part of parts(s.call.raw!, s.call.rawType)) {
            if (part.filename === undefined) {
              properties[part.name] = fieldSchema(s, part.name, part.content);
              continue;
            }
            const p = c.payloads.get(part.content);
            properties[part.name] = {
              type: "string",
              contentMediaType: part.type ?? "application/octet-stream",
              description: `${p === undefined ? "Sent" : `The payload ${code(p.name)}, sent`} under the filename ${part.filename}.`,
            };
            encoding[part.name] = { contentType: part.type ?? "application/octet-stream" };
          }
        } else throw new Error(`${s.id} sends a ${type} body, which the document cannot describe`);
        content[type] = {
          schema: { type: "object", properties, required: Object.keys(properties) },
          ...(Object.keys(encoding).length === 0 ? {} : { encoding }),
        };
      }
    }

    if (json.examples.size > 0) {
      const examples: Obj = {};
      for (const [name, e] of json.examples) {
        const by = e.sent.map((s) => {
          const refused = s.call.asserts.some((a) => a.kind === "rejected");
          return `${s.id} sends it${refused ? " and expects it refused" : ""}.`;
        });
        examples[name] = example(e.payload, by.join(" "), false);
      }
      const schema = oneOf(json.schemas);
      content["application/json"] = { ...(schema === undefined ? {} : { schema }), examples };
    }

    return { required: bodies.length === op.sent.length, content };
  }

  /** What one call's assertions say about its answer beyond the status and the headers. */
  function facts(s: Sent, status: Status): string[] {
    const out: string[] = [];
    for (const a of s.call.asserts) {
      if (a.kind === "status" && a.codes.length > 1) out.push(list(a.codes.map(String), "or"));
      else if (a.kind === "bodyIs") {
        const echo = a.options.echo ?? [];
        const coding = a.options.compressed === true ? ", gzip-encoded" : a.options.compressed === false ? ", with no content coding" : "";
        out.push(`the body is ${code(shown(a.payload))}${echo.length === 0 ? "" : ` with an echo of ${list([...echo], "and")}`}${coding}`);
      } else if (a.kind === "emptyBody") out.push("no body");
      else if (a.kind === "noHeader") out.push(`no ${a.name}`);
      else if (a.kind === "fresh") out.push("x-rb-serial advances");
      else if (a.kind === "replayed") out.push("x-rb-serial repeats");
      else if (a.kind === "rejected") {
        const first = a.fields.length === 1 ? "" : `, or one of them where the declaration says reports ${code('"first"')}`;
        out.push(`the rejected status, naming ${list(a.fields, "and")}${first}`);
      } else if (a.kind === "unparseable") out.push(`the malformed status, because ${code(s.call.raw ?? "")} is not JSON`);
      else if (a.kind === "notFound") out.push(`the notFound status for ${s.call.path}`);
      else if (a.kind === "sameBodyAs") out.push("the same body as an earlier answer");
      else if (a.kind === "hasHeader" && a.name.toLowerCase() === "content-type" && !s.call.asserts.some((b) => b.kind === "bodyIs")) {
        out.push(`content-type ${describeMatch(a.match)}`);
      }
    }
    if (out.length === 0) out.push(failing(status) ? "any error body" : "any body");
    return out;
  }

  function responseHeaders(from: readonly Sent[]): Obj | undefined {
    const seen = new Map<string, { id: string; match: string | RegExp | undefined; serial?: "fresh" | "replayed" }[]>();
    const add = (name: string, e: { id: string; match: string | RegExp | undefined; serial?: "fresh" | "replayed" }) =>
      seen.set(name, [...(seen.get(name) ?? []), e]);
    for (const s of from) {
      for (const a of s.call.asserts) {
        if (a.kind === "hasHeader" && a.name.toLowerCase() !== "content-type") add(a.name.toLowerCase(), { id: s.id, match: a.match });
        else if (a.kind === "fresh" || a.kind === "replayed") add("x-rb-serial", { id: s.id, match: /^\d+$/, serial: a.kind });
        else if (a.kind === "bodyIs" && a.options.compressed === true) add("content-encoding", { id: s.id, match: "gzip" });
      }
    }
    if (seen.size === 0) return undefined;

    const out: Obj = {};
    for (const [name, entries] of seen) {
      const matches = [...new Map(entries.map((e) => [String(e.match), e.match])).values()];
      const only = matches.length === 1 ? matches[0] : undefined;
      const schema: Obj =
        typeof only === "string" ? { type: "string", const: only } : only instanceof RegExp && only.flags === "" ? { type: "string", pattern: only.source } : { type: "string" };
      const ids = [...new Set(entries.map((e) => e.id))];
      const sentences: string[] = [];
      if (entries.some((e) => e.serial === "fresh")) {
        sentences.push("One counter for the whole process, which the handler increments and writes. It has to be larger than on the last answer that carried it.");
      }
      if (entries.some((e) => e.serial === "replayed")) {
        sentences.push("The value the stored answer was written with. Every later request for the same cache key has to repeat it.");
      }
      if (schema.const === undefined && schema.pattern === undefined) {
        for (const m of matches) if (m !== undefined) sentences.push(`It ${describeMatch(m)}.`);
      }
      sentences.push(`Checked by ${list(ids, "and")}.`);
      // Tests sharing a status can check different headers of one answer, so a header is
      // required unless one of them lets it be absent.
      const absent = from.some((s) =>
        s.call.asserts.some(
          (a) => (a.kind === "noHeader" && a.name.toLowerCase() === name) || (name === "content-encoding" && a.kind === "bodyIs" && a.options.compressed !== true),
        ),
      );
      out[name] = { required: !absent, description: sentences.join(" "), schema };
    }
    return out;
  }

  function response(status: Status, from: readonly Sent[]): Obj {
    const declared = status === "4XX" ? " Each test below names its status by the field in the framework's client-exception/index.ts." : "";
    const lead = failing(status) ? [`The framework's own error body, which has to be non-empty JSON.${declared}`] : [];
    const description = [...lead, ...from.map((s) => `${s.id}: ${facts(s, status).join(", ")}.${captured(s)}`)].join("\n\n");
    const headers = responseHeaders(from);

    const bodies = from.flatMap((s) =>
      s.call.asserts.flatMap((a) => {
        if (a.kind !== "bodyIs") return [];
        const type = s.call.asserts.find((b) => b.kind === "hasHeader" && b.name.toLowerCase() === "content-type");
        return [{ s, a, type: mediaType(a.payload.format, type?.kind === "hasHeader" ? type.match : undefined) }];
      }),
    );

    let content: Obj | undefined;
    if (bodies.length > 0) {
      content = {};
      for (const type of new Set(bodies.map((b) => b.type))) {
        const typed = bodies.filter((b) => b.type === type);
        const schema = oneOf(typed.flatMap((b): Obj[] => [bodySchema(b.a.payload, b.a.options.echo ?? [])].filter((s) => s !== undefined)));
        const examples: Obj = {};
        for (const b of typed) {
          const echo = b.a.options.echo ?? [];
          const extra = echo.length === 0 ? "" : `The answer adds an echo object holding ${list([...echo], "and")}, as sent.`;
          examples[shown(b.a.payload)] ??= example(b.a.payload, extra, true);
        }
        content[type] = { ...(schema === undefined ? {} : { schema }), examples };
      }
    } else if (failing(status)) {
      content = { "application/json": {} };
    }

    return { description, ...(headers === undefined ? {} : { headers }), ...(content === undefined ? {} : { content }) };
  }

  function operation(op: Operation): Obj {
    const tests = [...new Map(op.sent.map((s) => [s.id, s])).values()];
    const description = tests
      .map((s) => {
        const kind = s.test.kind === "validation" ? ", a validation test that is not measured" : "";
        const other = otherHeaders(s);
        const sends = other.length === 0 ? "" : ` It sends ${list(other, "and")}.`;
        return `**${s.id}** (${fileOf(s.id)}${kind}). ${s.test.about}${sends}`;
      })
      .join("\n\n");

    const byStatus = new Map<Status, Sent[]>();
    for (const s of op.sent) for (const status of statusesOf(s.call.asserts)) byStatus.set(status, [...(byStatus.get(status) ?? []), s]);
    const order = [...byStatus.keys()].sort((a, b) => rank(a) - rank(b));
    const responses = Object.fromEntries(order.map((status) => [String(status), response(status, byStatus.get(status)!)]));

    const bearer = op.sent.some((s) => s.call.headers.some(([name, v]) => name.toLowerCase() === "authorization" && v.startsWith("Bearer ")));
    const body = requestBody(op);
    const params = parameters(op);
    const words = `${op.method.toLowerCase()} ${op.route}`.split(/[^A-Za-z0-9]+/).filter((w) => w !== "");

    return {
      operationId: words.map((w, i) => (i === 0 ? w : w[0]!.toUpperCase() + w.slice(1))).join(""),
      summary: tests.map((s) => s.id).join(", "),
      description,
      tags: [...new Set(tests.map((s) => s.test.id.family))],
      ...(bearer ? { security: [{ bearer: [] }] } : {}),
      ...(params.length === 0 ? {} : { parameters: params }),
      ...(body === undefined ? {} : { requestBody: body }),
      responses,
    };
  }

  function unroutedDescription(u: Unrouted): string {
    const { id, test, call } = u.sent;
    if (u.miss === "method") {
      return `**${id}** (${fileOf(id)}) sends ${call.method} here, and no route may answer it. The router answers with the wrongMethod status in the framework's client-exception/index.ts, and the framework's own error body. ${test.about}`;
    }
    return `**${id}** (${fileOf(id)}) sends ${call.method} here, and no route matches the path. The router answers with the notFound status in the framework's client-exception/index.ts, and the framework's own error body.${captured(u.sent)} ${test.about}`;
  }

  const { ops, unrouted } = operations(c.sent);
  const paths: Record<string, Obj> = { ...header.paths };
  for (const route of [...new Set([...ops.map((o) => o.route), ...unrouted.map((u) => u.route)])]) {
    const item: Obj = {};
    const notes = unrouted.filter((u) => u.route === route);
    if (notes.length > 0) {
      item.summary = notes.map((u) => u.sent.id).join(", ");
      item.description = notes.map(unroutedDescription).join("\n\n");
    }
    for (const method of METHODS) {
      const op = ops.find((o) => o.route === route && o.method === method);
      if (op !== undefined) item[method.toLowerCase()] = operation(op);
    }
    paths[route] = item;
  }

  const families = new Set(c.sent.map((s) => s.test.id.family));
  const body: Obj = {
    servers: header.servers,
    tags: Object.values(suite.families)
      .filter((f) => families.has(f.name))
      .map((f) => ({ name: f.name, description: `${f.about}\n\nComparable ${f.comparable.charAt(0).toLowerCase()}${f.comparable.slice(1)}` })),
    paths: Object.fromEntries(Object.entries(paths).sort(([a], [b]) => a.localeCompare(b))),
    components: { schemas: schemas.components(), securitySchemes: header.securitySchemes },
  };
  const version = createHash("sha256").update(JSON.stringify(body)).digest("hex").slice(0, 12);

  return { openapi: "3.1.1", info: info(version), ...body };
}

// The header: what the corpus cannot say about itself, because it is the contract's.

function info(version: string): Obj {
  return {
    title: "RequestBench corpus",
    version,
    description: [
      "Generated from the corpus in tests/ by orchestrator/openapi.ts. Do not edit it. Run npm run spec after changing a test or a payload. npm test fails while this file is out of date.",
      "It is the same for every framework. Each operation is what one or more tests send. Its summary names the tests, and its description gives each test's file and quotes its about.",
      "Every body the corpus compares is a payload. The harness copies tests/payloads/ into the container and names the directory in RB_PAYLOADS. Load every file before /health answers 200, keep the parsed objects in the framework's own types, and serialise them on every request. Compute nothing ahead of a request.",
      "An example on each body names the payload it is, and holds no value. When the payload is a committed file, the example links to it, such as items.large to tests/payloads/items.large.json. That file is the exact answer. A computed answer, such as a row, a rendered page or the bind answer, has no file. Its example names the payloads it is computed from, and tests/payloads/index.ts computes it.",
      "A value written {run.name} is drawn once per run and never given to the framework. A handler binds it as the type its schema gives and writes it back in an echo object beside the payload's own fields.",
      "x-rb-serial is one counter for the whole process. A handler that writes it increments it and writes the new value. A stored answer replayed from a cache carries the value it was stored with.",
      "An answer of 400 or above carries the framework's own error body, which has to be non-empty JSON. The corpus reads a refusal only through the framework's frameworks/<language>/<name>/client-exception/index.ts. That declaration gives four statuses, which this document writes as 4XX and names by field: rejected, malformed, notFound and wrongMethod. It also says whether a rejection names every bad field or only the first. A new framework writes its declaration and registers it in frameworks/exceptions.ts.",
      "A path's own description names any request sent there that no route may answer.",
      "The values a framework configures itself from are in tests/payloads/settings.json. They are the bearer token, the CORS policy attached to /cors, and the cache's capacity, lifetime and vary headers.",
      "The harness passes PORT and RB_HOST. /health and /__meta are the contract's own and are not tests.",
    ].join("\n\n"),
  };
}

const header = {
  servers: [
    {
      url: "http://localhost:{port}",
      description: "A target binds 8080 in a container, and PORT as a host process.",
      variables: { port: { default: "8080" } },
    },
  ],
  securitySchemes: {
    bearer: { type: "http", scheme: "bearer", description: "The token is token in tests/payloads/settings.json." },
  },
  paths: {
    "/health": {
      get: {
        operationId: "getHealth",
        summary: "Readiness",
        description: "The harness polls this and starts measuring only after a 200. Answer it once every payload is loaded.",
        responses: { "200": { description: "Ready." } },
      },
    },
    "/__meta": {
      get: {
        operationId: "getMeta",
        summary: "What ran",
        description:
          "Not measured and not checked. Every key is recorded on the result row. The runner reads framework, version, runtime and adapter for its summary line, and bootMs for the boot report.",
        responses: {
          "200": {
            description: "A JSON object.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    framework: { type: "string" },
                    version: { type: "string" },
                    runtime: { type: "string" },
                    adapter: { type: "string" },
                    bootMs: { type: "number" },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;
