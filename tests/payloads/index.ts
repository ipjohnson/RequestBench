import { readFileSync } from "node:fs";
import type { z } from "zod";
import { html, json, lines, payload, text } from "#kit";
import type { Json, Payload, Schema } from "#kit";
import { bindEcho } from "#models/bind-echo";
import { item, itemPatch, newItem } from "#models/item";
import { orderRequest } from "#models/order-request";
import { LARGE, payloadLarge, payloadMedium, payloadSmall } from "#models/payload";
import { settings as settingsModel } from "#models/settings";
import { upload as uploadModel } from "#models/upload";

/**
 * The data every framework serves, one committed file per payload in this
 * directory, named for it: items.large is items.large.json. The files are the
 * source and nothing regenerates them. The item rows are the ones upstream
 * generated once.
 *
 * The harness copies this directory into each container and names it in
 * RB_PAYLOADS. A framework loads the files before /health answers, keeps the
 * parsed objects in its own types and serialises them on every request. Serving
 * a file's bytes would make the json rows measure a copy, and the comparison
 * cannot see that, because the bytes are the same.
 *
 * What a payload implies, such as one row, an echo, the bind answer or the
 * rendered page, is computed below and never published, so a framework has to
 * compute it too.
 */

const read = (file: string): string => readFileSync(new URL(file, import.meta.url), "utf8");
const load = <O>(name: string, model: Schema<unknown, O>): Payload<O> =>
  payload(name, model, JSON.parse(read(`${name}.json`)));

type Items = { readonly size: string; readonly count: number; readonly items: readonly z.infer<typeof item>[] };
type Order = z.infer<typeof orderRequest>;

export const items = {
  small: load("items.small", payloadSmall),
  medium: load("items.medium", payloadMedium),
  large: load("items.large", payloadLarge),
  /** An item without an id, which items.create and items.replace send. */
  new: load("items.new", newItem),
  /** The two fields items.update sends. */
  patch: load("items.patch", itemPatch),
};

export const order = {
  small: load("order.small", orderRequest),
  medium: load("order.medium", orderRequest),
  /** Wrong on all three fields, so it has no model to match. */
  invalid: json("order.invalid", JSON.parse(read("order.invalid.json")) as Json),
};

export const settings = load("settings", settingsModel);

export const forms = {
  /** The file part forms.multipart uploads, under this filename. */
  file: text("forms.file.txt", read("forms.file.txt")),
};

const rows = items.large.value.items.map((r) => json(`row ${r.id} of items.large`, r, { model: item, from: [items.large] }));

/** Row `id` of items.large, which items.read answers. */
export function row(id: number): Payload {
  const found = rows[id - 1];
  if (found === undefined) throw new Error(`items.large has no row ${id}`);
  return found;
}

/** The id items.create answers with, one past the last row, because a measured row writes nothing. */
export const CREATED = LARGE + 1;

export const created = json(`items.new as row ${CREATED}`, { id: CREATED, ...items.new.value }, { model: item, from: [items.new] });

/** items.new under the path's id, which items.replace answers. */
export const replaced = (id: number): Payload =>
  json(`items.new as row ${id}`, { id, ...items.new.value }, { model: item, from: [items.new] });

/** Row `id` with items.patch applied, which items.update answers. */
export const patched = (id: number): Payload =>
  json(
    `row ${id} of items.large with items.patch applied`,
    { ...items.large.value.items[id - 1]!, ...items.patch.value },
    { model: item, from: [items.large, items.patch] },
  );

/** Every value in an order that is not an object or a list. */
function leaves(v: unknown): number {
  if (Array.isArray(v)) return v.reduce((n: number, x) => n + leaves(x), 0);
  if (v !== null && typeof v === "object") return Object.values(v).reduce((n: number, x) => n + leaves(x), 0);
  return 1;
}

/**
 * What a bind or validate row answers for the order it sent: the leaves the
 * handler found, the bytes it received, and the order back. `bytes` is the
 * length of the body as the clients send it, which is JSON.stringify's.
 */
function bound(name: string, sent: Payload<Order>) {
  const bytes = new TextEncoder().encode(JSON.stringify(sent.value)).length;
  return payload(name, bindEcho, { fields: leaves(sent.value), bytes, echo: sent.value }, [sent]);
}

export const bind = {
  small: bound("bind.small", order.small),
  medium: bound("bind.medium", order.medium),
};

/** What forms.multipart answers beside its echo. */
export const uploaded = payload(
  "forms.file.txt as received",
  uploadModel,
  { file: { name: forms.file.name, bytes: new TextEncoder().encode(forms.file.value).length } },
  [forms.file],
);

/**
 * The page the template rows render, as upstream's templates wrote it. The
 * comparison ignores whitespace at element boundaries, so an engine's
 * indentation is free.
 */
function page(p: Payload<Items>): Payload<string> {
  const { size, count } = p.value;
  const body = p.value.items
    .map((it) => `<tr><td>${it.id}</td><td>${it.name}</td><td>${it.category}</td><td>${it.priceCents}</td><td>${it.inStock ? "yes" : "no"}</td></tr>`)
    .join("");
  return html(
    `${p.name} as a page`,
    "<!doctype html><html><head><title>items</title></head><body>" +
      `<h1>${size}</h1><table><thead><tr><th>id</th><th>name</th><th>category</th><th>price</th><th>stock</th></tr></thead>` +
      `<tbody>${body}</tbody></table><p>${count} rows</p></body></html>`,
    [p],
  );
}

export const pages = {
  small: page(items.small),
  medium: page(items.medium),
};

/** items.medium's rows, one per line, which stream.ndjson writes. */
export const stream = lines("items.medium, one row per line", items.medium.value.items, [items.medium]);

/** items.large.json as it is committed, which static.file serves byte for byte. */
export const file = text("items.large.json", read("items.large.json"));
