// Values drawn once per run, and where they go.
//
// A handler that binds and echoes what it was sent is only tested if the target could not
// have known what it would be sent. spec/plan.json carries a {run.<name>} placeholder wherever
// such a value goes, and the declaration it is drawn from. harness/run.py draws the values
// once per run and hands the same ones to this client for every target, which is what lets
// the anchor's echoed bodies be the reference for the rest of its language.
import { randomInt } from "node:crypto";

/** How one value is drawn. Every kind has a fixed length, so each run sends the same bytes. */
export type RunValue =
  | { readonly kind: "int"; readonly digits: number }
  | { readonly kind: "string"; readonly length: number; readonly chars: string }
  | {
    readonly kind: "words"; readonly count: number; readonly length: number;
    readonly chars: string;
  }
  | { readonly kind: "choice"; readonly values: readonly string[] };

/** One run's values by name: an int as a number, anything else as a string. */
export type Values = ReadonlyMap<string, number | string>;

const PLACEHOLDER = /\{run\.([a-z_]+)\}/g;
const WHOLE = /^\{run\.([a-z_]+)\}$/;

const text = (length: number, chars: string): string =>
  Array.from({ length }, () => chars.charAt(randomInt(chars.length))).join("");

/** One value per declaration, from a source no target can read. */
export function draw(declared: Readonly<Record<string, RunValue>>): Values {
  const out = new Map<string, number | string>();
  for (const [name, rule] of Object.entries(declared)) {
    switch (rule.kind) {
      case "int":
        out.set(name, randomInt(10 ** (rule.digits - 1), 10 ** rule.digits));
        break;
      case "string":
        out.set(name, text(rule.length, rule.chars));
        break;
      case "words":
        out.set(name, Array.from({ length: rule.count }, () => text(rule.length, rule.chars))
          .join(" "));
        break;
      case "choice":
        out.set(name, rule.values[randomInt(rule.values.length)] as string);
        break;
    }
  }
  return out;
}

/**
 * The values harness/run.py drew, as it passed them: one JSON object.
 *
 * Checked against the declarations rather than trusted, because a name missing here leaves a
 * placeholder in the request and a number sent as a string fails every echo for a reason that
 * has nothing to do with the target.
 */
export function parseValues(json: string, declared: Readonly<Record<string, RunValue>>): Values {
  const raw = JSON.parse(json) as Record<string, unknown>;
  const out = new Map<string, number | string>();
  for (const [name, rule] of Object.entries(declared)) {
    const v = raw[name];
    const ok = rule.kind === "int" ? Number.isInteger(v) : typeof v === "string";
    if (!ok) throw new Error(`${name} is ${JSON.stringify(v)} and the plan declares it ${rule.kind}`);
    out.set(name, v as number | string);
  }
  const extra = Object.keys(raw).filter((k) => !(k in declared));
  if (extra.length > 0) throw new Error(`${extra.join(", ")} is not declared in the plan`);
  return out;
}

function valueOf(values: Values, name: string): number | string {
  const v = values.get(name);
  if (v === undefined) throw new Error(`no value was drawn for {run.${name}}`);
  return v;
}

/**
 * A path from the plan with every value in it.
 *
 * Percent-encoded, with a space as %20 and never +: RFC 3986 does not read + as a space, and a
 * framework that decodes the form way would read one back where the value had a plus.
 */
export const inPath = (path: string, values: Values): string =>
  path.replace(PLACEHOLDER, (_, name: string) => encodeURIComponent(String(valueOf(values, name))));

/** A header value from the plan with every value in it, as it is. */
export const inHeader = (value: string, values: Values): string =>
  value.replace(PLACEHOLDER, (_, name: string) => String(valueOf(values, name)));

/**
 * An expected body with each placeholder replaced by the value it stands for.
 *
 * spec/expected.json cannot hold a value drawn after it was written, so it holds the
 * placeholder, always as a string. An int goes back in as the number it is.
 */
export function filled(body: unknown, values: Values): unknown {
  if (typeof body === "string") {
    const m = WHOLE.exec(body);
    return m ? valueOf(values, m[1] as string) : body;
  }
  if (Array.isArray(body)) return body.map((b) => filled(b, values));
  if (isObject(body)) {
    return Object.fromEntries(Object.entries(body).map(([k, v]) => [k, filled(v, values)]));
  }
  return body;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Why this response's echo is not what was sent, or null.
 *
 * The gate has no expectation to hold a body to, only another target, and the anchor measured
 * first has nothing at all. Without this an anchor that ignored its input would become the
 * reference and every target that bound correctly would be reported as the one that drifted.
 */
export function echoProblem(names: readonly string[], body: unknown, values: Values): string | null {
  const echo = isObject(body) ? body["echo"] : undefined;
  if (!isObject(echo)) return "no echo object (the response has to hold what the handler bound)";
  for (const name of names) {
    const sent = valueOf(values, name);
    if (!(name in echo)) return `echo.${name}: ${JSON.stringify(sent)} was sent and not echoed`;
    if (echo[name] !== sent) {
      return `echo.${name}: ${JSON.stringify(sent)} was sent, ${JSON.stringify(echo[name])} came back`;
    }
  }
  const extra = Object.keys(echo).find((k) => !names.includes(k));
  return extra === undefined ? null : `echo.${extra}: nothing by that name was sent`;
}
