import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { build } from "../Implementation/app.ts";
import { load } from "../Implementation/payloads.ts";

/** tests/payloads, found by walking up from this file to the repository. */
function find(): string {
  for (let dir = import.meta.dirname; dir !== dirname(dir); dir = dirname(dir)) {
    const candidate = join(dir, "tests", "payloads");
    if (existsSync(join(candidate, "items.large.json"))) return candidate;
  }
  throw new Error(`no tests/payloads above ${import.meta.dirname}`);
}

/** The payload directory, as rb suite names it in RB_PAYLOADS, or found. */
export const directory = process.env["RB_PAYLOADS"] ?? find();

/**
 * The Implementation, built as the server builds it and never listening. app.request(), which h3's
 * documentation shows for fetching the application's routes, hands it a Request with no socket and
 * resolves to the Response.
 */
export const app = build(load(directory));

interface Row {
  readonly id: number;
  readonly name: string;
  readonly category: string;
  readonly priceCents: number;
  readonly inStock: boolean;
}

/** What an answer has to be, read from the committed payloads rather than from the Implementation. */
export const expected = {
  bytes: (file: string): Buffer => readFileSync(join(directory, file)),

  json: (file: string): Record<string, unknown> => JSON.parse(readFileSync(join(directory, file), "utf8")),

  /** A payload with an echo object beside its own fields, as a binding handler answers. */
  withEcho: (file: string, echo: Record<string, unknown>): Record<string, unknown> => ({ ...expected.json(file), echo }),

  /** Row `id` of items.large. */
  row: (id: number): Row => (expected.json("items.large.json").items as Row[]).find((r) => r.id === id)!,

  /** The page the template rows render, as tests/payloads/index.ts writes it. */
  page(file: string): string {
    const p = expected.json(file) as { size: string; count: number; items: Row[] };
    const rows = p.items
      .map((it) => `<tr><td>${it.id}</td><td>${it.name}</td><td>${it.category}</td><td>${it.priceCents}</td><td>${it.inStock ? "yes" : "no"}</td></tr>`)
      .join("");
    return (
      "<!doctype html><html><head><title>items</title></head><body>" +
      `<h1>${p.size}</h1><table><thead><tr><th>id</th><th>name</th><th>category</th><th>price</th><th>stock</th></tr></thead>` +
      `<tbody>${rows}</tbody></table><p>${p.count} rows</p></body></html>`
    );
  },
};

/** Whitespace at an element boundary removed and every other run collapsed, as the corpus compares a page. */
export const normal = (html: string): string =>
  html.replace(/[ \t\n\r\f\v]+/g, " ").replace(/>[ ]+/g, ">").replace(/[ ]+</g, "<").trim();

/** The values a run draws, fixed as orchestrator/test/reference.ts fixes them. */
export const run = {
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
} as const;
