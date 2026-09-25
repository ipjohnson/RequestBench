// The error contracts the reference answers in, written for the orchestrator's own tests. Each is
// a declaration as a framework's client-exception/index.ts writes one, with the answer the
// reference gives each refusal row. Between them they vary what the frameworks' contracts vary:
// 400 or 422 for a rejected body, a malformed body refused with the same status or another, 404
// or 405 for a wrong method, every bad field or only the first, and error bodies of JSON or none.
import { z } from "zod";

import { exceptions, fromClr, fromLoc, fromPointer, toClr } from "@rb/tests/kit";
import type { Contract } from "./reference.ts";

const ORDER_INVALID = "https://tools.ietf.org/html/rfc9110#section-15.5.1";

/** RFC 9457 problem details, each bad field under errors by its CLR path, as ASP.NET Core writes them. */
export const PROBLEM_DETAILS: Contract = {
  id: "reference:problem-details",
  declared: exceptions({
    about: "RFC 9457 problem details, with each bad field under errors by its CLR path.",
    rejected: 400,
    notFound: 404,
    wrongMethod: 405,
    envelope: z.object({
      type: z.string(),
      title: z.string(),
      status: z.number(),
      errors: z.record(z.string(), z.array(z.string())).optional(),
    }),
    fields: (b) => Object.keys(b.errors ?? {}).map(fromClr),
    message: (b, f) => b.errors?.[toClr(f)]?.[0],
  }),
  answers: {
    "authorized.denied": { status: 403, body: { type: "https://tools.ietf.org/html/rfc9110#section-15.5.4", title: "Forbidden", status: 403 } },
    "body.rejected_all": {
      status: 400,
      body: {
        type: ORDER_INVALID,
        title: "One or more validation errors occurred.",
        status: 400,
        errors: {
          CustomerId: ["'Customer Id' must be greater than '0'."],
          Status: ["'Status' must not be empty."],
          Lines: ["'Lines' must not be empty."],
        },
      },
    },
    "body.rejected_first": {
      status: 400,
      body: { type: ORDER_INVALID, title: "One or more validation errors occurred.", status: 400, errors: { CustomerId: ["'Customer Id' must be greater than '0'."] } },
    },
    "errors.malformed": { status: 400, body: { type: ORDER_INVALID, title: "Bad Request", status: 400 } },
    "errors.unmatched": { status: 404 },
  },
};

const Detail = z.object({ loc: z.array(z.union([z.string(), z.number()])), msg: z.string() });

/** A list under detail, each entry naming its field by a loc that starts with where the value came from, as pydantic writes one. */
export const VALIDATION_LIST: Contract = {
  id: "reference:validation-list",
  declared: exceptions({
    about: "A list under detail, each entry naming its field by a loc that starts with the value's source.",
    rejected: 422,
    notFound: 404,
    wrongMethod: 405,
    envelope: z.object({ detail: z.union([z.string(), z.array(Detail)]) }),
    fields: (b) => (typeof b.detail === "string" ? [] : b.detail.map((d) => fromLoc(d.loc))),
    message: (b, f) => (typeof b.detail === "string" ? undefined : b.detail.find((d) => fromLoc(d.loc) === f)?.msg),
  }),
  answers: {
    "authorized.denied": { status: 403, body: { detail: "Forbidden" } },
    "body.rejected_all": {
      status: 422,
      body: {
        detail: [
          { type: "greater_than", loc: ["body", "customerId"], msg: "Input should be greater than 0", input: 0 },
          { type: "string_too_short", loc: ["body", "status"], msg: "String should have at least 1 character", input: "" },
          { type: "too_short", loc: ["body", "lines"], msg: "List should have at least 1 item after validation, not 0", input: [] },
        ],
      },
    },
    "body.rejected_first": {
      status: 422,
      body: { detail: [{ type: "greater_than", loc: ["body", "customerId"], msg: "Input should be greater than 0", input: 0 }] },
    },
    "errors.malformed": { status: 422, body: { detail: [{ type: "json_invalid", loc: ["body", 28], msg: "JSON decode error", input: {} }] } },
    "errors.unmatched": { status: 404, body: { detail: "Not Found" } },
  },
};

/** `body/customerId must be >= 1` -> `customerId` */
const POINTED = /^body(\/\S*) (.+)$/;

/** The first rule a body breaks, named by its JSON pointer in message, as Fastify's validation answers, with 404 for a method a path lacks. */
export const FIRST_ERROR: Contract = {
  id: "reference:first-error",
  declared: exceptions({
    about: "The first rule a body breaks, named by its JSON pointer in message.",
    rejected: 400,
    notFound: 404,
    wrongMethod: 404,
    reports: "first",
    envelope: z.object({ statusCode: z.number(), error: z.string(), message: z.string(), code: z.string().optional() }),
    fields: (b) => {
      const m = POINTED.exec(b.message);
      return m === null ? [] : [fromPointer(m[1]!)];
    },
    message: (b, f) => {
      const m = POINTED.exec(b.message);
      return m !== null && fromPointer(m[1]!) === f ? m[2] : undefined;
    },
  }),
  answers: {
    "authorized.denied": { status: 403 },
    "body.rejected_all": {
      status: 400,
      body: { statusCode: 400, code: "FST_ERR_VALIDATION", error: "Bad Request", message: "body/customerId must be >= 1" },
    },
    "body.rejected_first": {
      status: 400,
      body: { statusCode: 400, code: "FST_ERR_VALIDATION", error: "Bad Request", message: "body/customerId must be >= 1" },
    },
    "errors.malformed": {
      status: 400,
      body: { statusCode: 400, code: "FST_ERR_CTP_INVALID_JSON_BODY", error: "Bad Request", message: "Body is not valid JSON but content-type is set to 'application/json'" },
    },
    "errors.unmatched": { status: 404, body: { message: "Route GET:/errors/unmatched not found", error: "Not Found", statusCode: 404 } },
  },
};

/** `lines[0].qty: must be greater than 0` */
const LINE = /^([A-Za-z]\w*(?:\[\d+\]\.[A-Za-z]\w*)*): (.+)$/;

const broken = (b: { error: string }) =>
  b.error.split("\n").flatMap((line) => {
    const m = LINE.exec(line);
    return m === null ? [] : [{ field: m[1]!.replace(/\[(\d+)\]/g, ".$1"), message: m[2]! }];
  });

/** The error's text under error, a rule to a line, refused with 422 while a body that does not parse gets 400, and a text body for anything else. */
export const TEXT_LINES: Contract = {
  id: "reference:text-lines",
  declared: exceptions({
    about: "The error's text under error, a rule to a line, and a text body for anything else.",
    rejected: 422,
    malformed: 400,
    notFound: 404,
    wrongMethod: 404,
    envelope: z.object({ error: z.string() }),
    fields: (b) => broken(b).map((x) => x.field),
    message: (b, f) => broken(b).find((x) => x.field === f)?.message,
  }),
  answers: {
    "authorized.denied": { status: 403 },
    "body.rejected_all": { status: 422, body: { error: "customerId: must be greater than 0\nstatus: must not be empty\nlines: must not be empty" } },
    "body.rejected_first": { status: 422, body: { error: "customerId: must be greater than 0" } },
    "errors.malformed": { status: 400, body: { error: "unexpected EOF" } },
    "errors.unmatched": { status: 404 },
  },
};

export const CONTRACTS: readonly Contract[] = [PROBLEM_DETAILS, VALIDATION_LIST, FIRST_ERROR, TEXT_LINES];
