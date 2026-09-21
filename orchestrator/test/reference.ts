// A framework that answers every request in the corpus correctly, written from the
// payloads the way a framework would be.
//
// It is a second author. Each route computes its answer from the request and the
// published data rather than from what a test expects, so a test that names the wrong
// payload for its path fails here. What a framework writes in its own words, which is
// every error body, comes from the snapshot beside each refusal row, as that framework
// was captured answering. An ETag hashed from the body and a serial that advances when a
// handler runs and repeats when a stored answer is replayed are written the way a
// correct framework writes them. Those halves are only as strong as the checks in the
// tests that read them.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

import type { Draw, Exceptions, RunValues } from "@rb/tests/kit";
import { orderRequest } from "@rb/tests/models/order-request";
import { items, settings } from "@rb/tests/payloads";
import type { Snapshot } from "../snapshots.ts";
import type { Request, Response, Transport } from "../validate.ts";

/** Values of the shape a run draws, fixed so that a failure reproduces. */
export const RUN: RunValues = {
  one: 4821,
  two: 7390,
  tenant: "qwertyuiopas",
  requestId: "0123456789abcdef",
  account: 482913,
  page: 417,
  size: 38,
  status: "paid",
  category: "garden",
  sort: "created",
  q: "alpha bravo",
  minPrice: 1200,
  maxPrice: 34000,
};

/** The picks a test makes per instance, made the same way every time so a failure reproduces. */
export const DRAW: Draw = {
  choice: <T>(values: readonly T[]) => values[0] as T,
  item: () => 17,
};

interface Reply {
  readonly status: number;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string | Uint8Array;
}

type Handler = (req: Request, m: RegExpExecArray, url: URL) => Reply;
type Route = readonly [method: string, pattern: RegExp, handler: Handler];

const utf8 = (s: string) => new TextEncoder().encode(s);
const JSON_TYPE = "application/json; charset=utf-8";
const json = (value: unknown, status = 200): Reply => ({ status, headers: { "content-type": JSON_TYPE }, body: JSON.stringify(value) });
const etagOf = (body: Uint8Array) => `"${createHash("sha1").update(body).digest("hex")}"`;

const small = items.small.value;
const sized = { small, medium: items.medium.value, large: items.large.value } as const;
const rows = items.large.value.items;
const cors = settings.value.cors;
const PAYLOADS = join(import.meta.dirname, "../../tests/payloads");

const echoed = (echo: Record<string, unknown>) => json({ ...small, echo });

/** A query value or a form field the way a framework binds it: the numbers as numbers. */
function bound(params: URLSearchParams, names: readonly string[]): Record<string, unknown> {
  const numbers = new Set(["page", "size", "minPrice", "maxPrice", "account"]);
  return Object.fromEntries(names.map((n) => [n, numbers.has(n) ? Number(params.get(n)) : params.get(n)]));
}

function leaves(v: unknown): number {
  if (Array.isArray(v)) return v.reduce((n: number, x) => n + leaves(x), 0);
  if (v !== null && typeof v === "object") return Object.values(v).reduce((n: number, x) => n + leaves(x), 0);
  return 1;
}

/** The template every framework renders, indented the way an engine would write it. */
function page(p: { size: string; count: number; items: readonly (typeof rows)[number][] }): Reply {
  const body = p.items
    .map((it) => `        <tr>\n          <td>${it.id}</td>\n          <td>${it.name}</td>\n          <td>${it.category}</td>\n` +
      `          <td>${it.priceCents}</td>\n          <td>${it.inStock ? "yes" : "no"}</td>\n        </tr>`)
    .join("\n");
  const html =
    `<!doctype html>\n<html>\n  <head><title>items</title></head>\n  <body>\n    <h1>${p.size}</h1>\n    <table>\n` +
    `      <thead>\n        <tr><th>id</th><th>name</th><th>category</th><th>price</th><th>stock</th></tr>\n      </thead>\n` +
    `      <tbody>\n${body}\n      </tbody>\n    </table>\n    <p>${p.count} rows</p>\n  </body>\n</html>\n`;
  return { status: 200, headers: { "content-type": "text/html; charset=utf-8" }, body: html };
}

/** The parts of a multipart body, by field name. */
function parts(body: string, type: string): Map<string, { filename: string | undefined; content: string }> {
  const out = new Map<string, { filename: string | undefined; content: string }>();
  const boundary = /boundary=([^;]+)/.exec(type)?.[1];
  if (boundary === undefined) return out;
  for (const chunk of body.split(`--${boundary}`).slice(1, -1)) {
    const split = chunk.indexOf("\r\n\r\n");
    const head = chunk.slice(0, split);
    const name = /name="([^"]*)"/.exec(head)?.[1];
    if (name !== undefined) out.set(name, { filename: /filename="([^"]*)"/.exec(head)?.[1], content: chunk.slice(split + 4, -2) });
  }
  return out;
}

/**
 * The whole corpus as one framework answers it. `snapshots` holds the refusal rows,
 * whose bodies are each framework's own.
 */
export function corpusReference(snapshots: ReadonlyMap<string, Snapshot>, framework: string, declared: Exceptions) {
  const own = (id: string, status?: number): Reply => {
    const captured = snapshots.get(id)?.frameworks[framework];
    if (captured === undefined) throw new Error(`no ${id} answer for ${framework}`);
    return captured.body === undefined ? { status: status ?? captured.status } : json(captured.body, status ?? captured.status);
  };
  const notFound = () => own("errors.unmatched", declared.notFound);

  function ordered(req: Request, refusal: string): Reply {
    let parsed: unknown;
    try {
      parsed = JSON.parse(req.body ?? "");
    } catch {
      return own("errors.malformed");
    }
    if (refusal !== "" && !orderRequest.safeParse(parsed).success) return own(refusal);
    return json({ fields: leaves(parsed), bytes: utf8(req.body ?? "").length, echo: parsed });
  }

  function item(id: string): (typeof rows)[number] | undefined {
    return rows[Number(id) - 1];
  }

  const routes: readonly Route[] = [
    ["GET", /^\/plaintext$/, () => ({ status: 200, headers: { "content-type": "text/plain; charset=utf-8" }, body: "Hello, World!" })],
    ["GET", /^\/json\/(small|medium|large)$/, (_, m) => json(sized[m[1] as keyof typeof sized])],
    ["GET", /^\/middleware\/(?:none|four|sixteen)$/, () => json(small)],
    ["GET", /^\/parameters\/static\/segment\/literal$/, () => json(small)],
    ["GET", /^\/parameters\/(\d+)\/segment\/literal$/, (_, m) => echoed({ one: Number(m[1]) })],
    ["GET", /^\/parameters\/(\d+)\/with-second\/(\d+)$/, (_, m) => echoed({ one: Number(m[1]), two: Number(m[2]) })],
    ["GET", /^\/query\/one$/, (_, __, url) => echoed(bound(url.searchParams, ["page"]))],
    ["GET", /^\/query\/many$/, (_, __, url) =>
      echoed(bound(url.searchParams, ["page", "size", "status", "category", "sort", "q", "minPrice", "maxPrice"]))],
    ["GET", /^\/headers$/, () => json(small)],
    ["GET", /^\/headers\/bind$/, (req) =>
      echoed({ tenant: req.headers["x-rb-tenant"], requestId: req.headers["x-rb-request-id"], account: Number(req.headers["x-rb-account"]) })],
    ["POST", /^\/body\/bind\/(?:small|medium)$/, (req) => ordered(req, "")],
    ["POST", /^\/body\/validate\/(?:small|medium)$/, (req) => ordered(req, "body.rejected_all")],
    ["POST", /^\/body\/validate\/first-error$/, (req) => ordered(req, "body.rejected_first")],
    ["GET", /^\/authorized\/small$/, (req) =>
      req.headers["authorization"] === `Bearer ${settings.value.token}` ? json(small) : own("authorized.denied")],
    ["GET", /^\/(?:cache|compressed|etag)\/(small|medium|large)$/, (_, m) => json(sized[m[1] as keyof typeof sized])],
    ["GET", /^\/cache\/vary\/(?:one|many)$/, () => json(small)],
    ["GET", /^\/template\/(small|medium)$/, (_, m) => page(sized[m[1] as "small" | "medium"])],

    ["GET", /^\/items\/(\d+)$/, (_, m) => {
      const found = item(m[1]!);
      return found === undefined ? notFound() : json(found);
    }],
    ["POST", /^\/items$/, (req) => ({
      ...json({ id: rows.length + 1, ...(JSON.parse(req.body ?? "") as object) }, 201),
      headers: { "content-type": JSON_TYPE, location: `/items/${rows.length + 1}` },
    })],
    ["PUT", /^\/items\/(\d+)$/, (req, m) => json({ id: Number(m[1]), ...(JSON.parse(req.body ?? "") as object) })],
    ["PATCH", /^\/items\/(\d+)$/, (req, m) => {
      const found = item(m[1]!);
      return found === undefined ? notFound() : json({ ...found, ...(JSON.parse(req.body ?? "") as object) });
    }],
    ["DELETE", /^\/items\/(\d+)$/, (_, m) => (item(m[1]!) === undefined ? notFound() : { status: 204 })],

    ["GET", /^\/cors\/small$/, () => json(small)],
    ["POST", /^\/forms\/urlencoded$/, (req) =>
      echoed(bound(new URLSearchParams(req.body ?? ""), ["page", "size", "status", "category", "sort", "q", "minPrice", "maxPrice"]))],
    ["POST", /^\/forms\/multipart$/, (req) => {
      const got = parts(req.body ?? "", req.headers["content-type"] ?? "");
      const upload = got.get("file");
      return json({
        file: { name: upload?.filename, bytes: utf8(upload?.content ?? "").length },
        echo: { tenant: got.get("tenant")?.content, requestId: got.get("requestId")?.content },
      });
    }],
    ["GET", /^\/stream\/items$/, () => ({
      status: 200,
      headers: { "content-type": "application/x-ndjson", "transfer-encoding": "chunked" },
      body: items.medium.value.items.map((r) => `${JSON.stringify(r)}\n`).join(""),
    })],
    ["GET", /^\/static\/([\w.-]+)$/, (_, m) => {
      const path = join(PAYLOADS, m[1]!);
      if (!existsSync(path)) return notFound();
      return {
        status: 200,
        headers: { "content-type": m[1]!.endsWith(".json") ? "application/json" : "text/plain", "last-modified": "Mon, 21 Sep 2026 00:00:00 GMT" },
        body: new Uint8Array(readFileSync(path)),
      };
    }],
  ];

  /** The route for a request, or why there is none: the path has no route, or not for this method. */
  function dispatch(req: Request, url: URL): Reply {
    const method = req.method === "HEAD" ? "GET" : req.method;
    let pathMatched = false;
    for (const [m, pattern, handler] of routes) {
      const match = pattern.exec(url.pathname);
      if (match === null) continue;
      pathMatched = true;
      if (m === method) return handler(req, match, url);
    }
    return pathMatched ? { status: declared.wrongMethod } : own("errors.unmatched");
  }

  /** A fresh process for one test: its own serial counter and its own response cache. */
  function transport(): Transport {
    let counter = 0;
    const stored = new Map<string, number>();

    return async (req: Request): Promise<Response> => {
      const url = new URL(req.target, "http://reference");
      const path = url.pathname;
      const origin = req.headers["origin"];
      const onCors = path.startsWith("/cors/");

      // The CORS feature answers a preflight on its own routes before any handler runs.
      if (onCors && req.method === "OPTIONS" && req.headers["access-control-request-method"] !== undefined) {
        const headers: Record<string, string> = { vary: "Origin", "content-length": "0" };
        if (origin === cors.origin) {
          headers["access-control-allow-origin"] = cors.origin;
          headers["access-control-allow-methods"] = cors.method;
          headers["access-control-allow-headers"] = cors.header;
          headers["access-control-max-age"] = String(cors.maxAgeSeconds);
        }
        return { status: 204, headers, body: new Uint8Array(0) };
      }

      const reply = dispatch(req, url);
      const headers: Record<string, string> = { ...reply.headers };
      let body = typeof reply.body === "string" ? utf8(reply.body) : (reply.body ?? new Uint8Array(0));

      if (reply.status === 200 && /^\/(?:etag|compressed|cors)\//.test(path)) headers["x-rb-serial"] = String(++counter);
      if (reply.status === 200 && path.startsWith("/cache/")) {
        const vary = Object.entries(req.headers).filter(([k]) => k.startsWith("x-rb-")).map(([k, v]) => `${k}=${v}`);
        const key = [path, ...vary.sort()].join("|");
        let s = stored.get(key);
        if (s === undefined) stored.set(key, (s = ++counter));
        headers["x-rb-serial"] = String(s);
      }
      if (reply.status === 200 && path.startsWith("/etag/")) {
        const tag = etagOf(body);
        if (req.headers["if-none-match"] === tag) return { status: 304, headers: { etag: tag }, body: new Uint8Array(0) };
        headers["etag"] = tag;
      }
      if (onCors && origin !== undefined) {
        headers["vary"] = "Origin";
        if (origin === cors.origin) headers["access-control-allow-origin"] = cors.origin;
      }
      if (path.startsWith("/compressed/") && (req.headers["accept-encoding"] ?? "").includes("gzip") && body.length >= 1024) {
        body = gzipSync(body);
        headers["content-encoding"] = "gzip";
      }
      if (headers["transfer-encoding"] === undefined) headers["content-length"] = String(body.length);
      return { status: reply.status, headers, body: req.method === "HEAD" ? new Uint8Array(0) : body };
    };
  }

  return { transport };
}
