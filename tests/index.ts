import { suite } from "#kit";
import authorized from "./authorized/index.ts";
import baseline from "./baseline/index.ts";
import body from "./body/index.ts";
import cache from "./cache/index.ts";
import compressed from "./compressed/index.ts";
import cors from "./cors/index.ts";
import errors from "./errors/index.ts";
import etag from "./etag/index.ts";
import forms from "./forms/index.ts";
import headers from "./headers/index.ts";
import items from "./items/index.ts";
import json from "./json/index.ts";
import middleware from "./middleware/index.ts";
import parameters from "./parameters/index.ts";
import query from "./query/index.ts";
import staticFiles from "./static/index.ts";
import stream from "./stream/index.ts";
import template from "./template/index.ts";

/**
 * The corpus. Discovery is what decides this list is complete: the loader reads
 * every tracked family directory and fails when one is missing from here, so a
 * family that exists and is not listed is an error rather than a family that
 * quietly never runs.
 */
export default suite([
  authorized,
  baseline,
  body,
  cache,
  compressed,
  cors,
  errors,
  etag,
  forms,
  headers,
  items,
  json,
  middleware,
  parameters,
  query,
  staticFiles,
  stream,
  template,
]);
