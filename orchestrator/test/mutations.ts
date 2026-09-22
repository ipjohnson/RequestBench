// The one mistake each assertion exists to catch, applied to a correct answer.
//
// A mistake changes only what its assertion reads, so a test that fails on it fails
// on that assertion alone. That is what lets a negative case say which assertion
// caught the mistake rather than that something did.
import { gunzipSync, gzipSync } from "node:zlib";

import type { BodyOptions, Json, Payload } from "@rb/tests/kit";
import type { Assert } from "../record.ts";
import type { Response } from "../validate.ts";

export interface Mistake {
  /** The assertion this mistake has to break, and the only one. */
  readonly breaks: Assert["kind"];
  readonly what: string;
  /** `first` is the answer the same request got the first time it was sent. */
  apply(r: Response, first: Response | undefined): Response;
}

const gzipped = (r: Response) => (r.headers["content-encoding"] ?? "").includes("gzip");

/** A new body, with Content-Length kept true where there is one and left absent where there is not. */
function withBody(r: Response, body: Uint8Array): Response {
  const length = r.headers["content-length"] === undefined ? {} : { "content-length": String(body.length) };
  return { ...r, headers: { ...r.headers, ...length }, body };
}

const decoded = (r: Response) => new TextDecoder().decode(gzipped(r) ? gunzipSync(r.body) : r.body);

/** Rewrite a text body, keeping its content coding. */
function withText(r: Response, change: (text: string) => string): Response {
  const next = new TextEncoder().encode(change(decoded(r)));
  return withBody(r, gzipped(r) ? gzipSync(next) : next);
}

function withHeader(r: Response, name: string, value: string | undefined): Response {
  const headers: Record<string, string> = { ...r.headers };
  if (value === undefined) delete headers[name];
  else headers[name] = value;
  return { ...r, headers };
}

/** Rewrite a JSON body, keeping its content coding, so nothing but the value changes. */
function withJson(r: Response, change: (value: Json) => Json): Response {
  return withText(r, (text) => JSON.stringify(change(JSON.parse(text) as Json)));
}

/** A different value of the same kind. */
const other = (v: Json): Json => (typeof v === "number" ? v + 1 : typeof v === "boolean" ? !v : typeof v === "string" ? `${v}x` : 0);

/** The last value in the body changed, which is the one a check that stopped early would miss. */
function lastLeaf(v: Json): Json {
  if (Array.isArray(v)) return v.length === 0 ? v : [...v.slice(0, -1), lastLeaf(v.at(-1)!)];
  if (v !== null && typeof v === "object") {
    const o = v as { readonly [key: string]: Json };
    const key = Object.keys(o).at(-1);
    return key === undefined ? o : { ...o, [key]: lastLeaf(o[key]!) };
  }
  return other(v);
}

/**
 * Every mention of a field, as a key, in a value or inside a sentence, named something else. A
 * mention with its first letter capitalised counts, because that is how a CLR property path
 * writes it, and so does one in snake_case, because that is how a Rust struct writes it.
 */
function rename(v: Json, from: string, to: string): Json {
  const spellings = [from, from.charAt(0).toUpperCase() + from.slice(1), from.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)];
  const renamed = (s: string) => spellings.reduce((t, f) => t.split(f).join(to), s);
  if (typeof v === "string") return renamed(v);
  if (Array.isArray(v)) return v.map((x) => rename(x, from, to));
  if (v !== null && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [renamed(k), rename(x, from, to)]));
  return v;
}

const status = (s: number) => (r: Response) => ({ ...r, status: s });

export function mistakesFor(a: Assert): Mistake[] {
  switch (a.kind) {
    case "ok":
      return [{ breaks: "ok", what: "the answer is 500", apply: status(500) }];
    case "status": {
      const s = a.codes.some((code) => code >= 200 && code < 300) ? 500 : 200;
      return [{ breaks: "status", what: `the answer is ${s}`, apply: status(s) }];
    }
    case "bodyIs":
      return [...bodyMistakes(a.payload, a.options), ...codingMistakes(a.options)];
    case "notModified":
      return [{ breaks: "notModified", what: "the conditional request is answered 200", apply: status(200) }];
    case "notFound":
      return [{ breaks: "notFound", what: "the answer is 200", apply: status(200) }];
    case "wrongMethod":
      return [{ breaks: "wrongMethod", what: "the method is answered 200", apply: status(200) }];
    case "unparseable":
      return [{ breaks: "unparseable", what: "the broken body is answered 200", apply: status(200) }];
    case "rejected": {
      const field = a.fields[0];
      const renamed: Mistake[] =
        field === undefined
          ? []
          : [
              {
                breaks: "rejected",
                what: `the refusal names ${field} as something else`,
                apply: (r) => withJson(r, (v) => rename(v, field, "rb_unexpected_field")),
              },
            ];
      return [{ breaks: "rejected", what: "the refusal is answered 200", apply: status(200) }, ...renamed];
    }
    case "hasHeader":
      return [
        {
          breaks: "hasHeader",
          what: `there is no ${a.name} header`,
          // A body still gzipped under no Content-Encoding is a second mistake, so the body goes back to identity too.
          apply: (r) =>
            a.name.toLowerCase() === "content-encoding" && gzipped(r)
              ? withBody(withHeader(r, "content-encoding", undefined), gunzipSync(r.body))
              : withHeader(r, a.name.toLowerCase(), undefined),
        },
      ];
    case "noHeader":
      return [{ breaks: "noHeader", what: `the answer carries ${a.name}`, apply: (r) => withHeader(r, a.name.toLowerCase(), "rb-unexpected") }];
    case "emptyBody":
      return [{ breaks: "emptyBody", what: "the answer carries a body", apply: (r) => withBody(r, new TextEncoder().encode("{}")) }];
    case "fresh":
      return [
        {
          breaks: "fresh",
          what: "the serial repeats, so the handler did not run",
          apply: (r, first) => withHeader(r, "x-rb-serial", first?.headers["x-rb-serial"]),
        },
      ];
    case "replayed":
      return [
        {
          breaks: "replayed",
          what: "the serial advances, so nothing was stored",
          apply: (r, first) => withHeader(r, "x-rb-serial", String(Number(first?.headers["x-rb-serial"]) + 1)),
        },
      ];
    case "sameBodyAs":
      return [];
  }
}

/** What a body can get wrong while staying well formed, which only comparing it with its payload sees. */
function bodyMistakes(payload: Payload, options: BodyOptions): Mistake[] {
  const breaks = "bodyIs";
  switch (payload.format) {
    case "json": {
      const [echoed] = options.echo ?? [];
      return [
        {
          breaks,
          what: "the body carries a field nobody asked for",
          apply: (r) => withJson(r, (v) => ({ ...(v as Record<string, Json>), rb_unexpected: true })),
        },
        echoed === undefined
          ? { breaks, what: "the last value in the body differs", apply: (r) => withJson(r, lastLeaf) }
          : {
              breaks,
              what: `the echoed ${echoed} is not what was sent`,
              apply: (r) =>
                withJson(r, (v) => {
                  const body = v as Record<string, Record<string, Json>>;
                  return { ...body, echo: { ...body["echo"], [echoed]: other(body["echo"]?.[echoed] ?? null) } };
                }),
            },
      ];
    }
    case "lines":
      return [{ breaks, what: "the last line is missing", apply: (r) => withText(r, (t) => t.replace(/[^\n]*\n?$/, "")) }];
    case "events":
      return [
        // The data line is still whole, so only a reader that waits for the blank line drops the event.
        { breaks, what: "the last event is never ended by a blank line", apply: (r) => withText(r, (t) => t.replace(/(?:\r\n|\r|\n)$/, "")) },
        {
          breaks,
          what: "the last value in the last event differs",
          apply: (r) =>
            withText(r, (t) =>
              t.replace(/data: (.*)((?:\r\n|\r|\n){2})$/, (_, data: string, end: string) => `data: ${JSON.stringify(lastLeaf(JSON.parse(data) as Json))}${end}`),
            ),
        },
        { breaks, what: "every event carries an id", apply: (r) => withText(r, (t) => t.replace(/^data: /gm, "id: 1\ndata: ")) },
        { breaks, what: "every event is named item", apply: (r) => withText(r, (t) => t.replace(/^data: /gm, "event: item\ndata: ")) },
      ];
    case "text":
      return [
        {
          breaks,
          what: "one byte in the middle differs",
          apply: (r) =>
            withText(r, (t) => {
              const mid = Math.floor(t.length / 2);
              return `${t.slice(0, mid)}${t[mid] === "a" ? "b" : "a"}${t.slice(mid + 1)}`;
            }),
        },
      ];
    case "html":
      return [
        {
          breaks,
          what: "the page carries an element nobody asked for",
          apply: (r) => withText(r, (t) => (t.includes("</body>") ? t.replace("</body>", "<p>rb_unexpected</p></body>") : `${t}<p>rb_unexpected</p>`)),
        },
      ];
  }
}

function codingMistakes(options: BodyOptions): Mistake[] {
  if (options.compressed === true) {
    return [
      {
        breaks: "bodyIs",
        what: "the body arrives with no content coding",
        apply: (r) => (gzipped(r) ? withBody(withHeader(r, "content-encoding", undefined), gunzipSync(r.body)) : r),
      },
    ];
  }
  if (options.compressed === false) {
    return [
      {
        breaks: "bodyIs",
        what: "the body arrives gzipped",
        apply: (r) => (gzipped(r) ? r : withBody(withHeader(r, "content-encoding", "gzip"), gzipSync(r.body))),
      },
    ];
  }
  return [];
}
