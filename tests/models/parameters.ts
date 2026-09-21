import { z } from "zod";
import type { Draw, RunValues } from "#kit";
import { CATEGORIES } from "#models/item";
import { LARGE } from "#models/payload";

/**
 * How one value a test reaches for is drawn, and the bounds it is drawn within as a schema,
 * so a value handed in rather than drawn is held to the same bounds and they are written
 * once.
 *
 * `random` returns a uniform number in [0, 1). The caller chooses the source: a run's values
 * have to come from one no framework can read, and a param only has to differ from one
 * instance to the next.
 */
export interface Value<T> {
  draw(random: () => number): T;
  readonly schema: z.ZodType<T>;
}

const pick = (random: () => number, n: number): number => Math.floor(random() * n);

function intRange(min: number, max: number): Value<number> {
  return {
    draw: (random) => min + pick(random, max - min + 1),
    schema: z.number().int().min(min).max(max),
  };
}

/** Exactly this many digits, so every run sends the same number of bytes. */
function int(digits: number): Value<number> {
  return intRange(10 ** (digits - 1), 10 ** digits - 1);
}

/** A regex character class holding exactly `chars`. */
const classOf = (chars: string): string => `[${chars.replace(/[\\\]^-]/g, "\\$&")}]`;

function string(length: number, chars: string): Value<string> {
  return {
    draw: (random) => {
      let out = "";
      for (let i = 0; i < length; i++) out += chars.charAt(pick(random, chars.length));
      return out;
    },
    schema: z.string().regex(new RegExp(`^${classOf(chars)}{${length}}$`)),
  };
}

/** `count` words of `length` characters, joined by single spaces. */
function words(count: number, length: number, chars: string): Value<string> {
  const word = string(length, chars);
  const one = `${classOf(chars)}{${length}}`;
  return {
    draw: (random) => Array.from({ length: count }, () => word.draw(random)).join(" "),
    schema: z.string().regex(new RegExp(`^${one}(?: ${one}){${count - 1}}$`)),
  };
}

function choice<const T extends string | number>(values: readonly [T, T, ...T[]]): Value<T> {
  const [a, b, ...rest] = values.map((v) => z.literal(v));
  return {
    draw: (random) => values[pick(random, values.length)]!,
    schema: z.union([a!, b!, ...rest]),
  };
}

const LOWER = "abcdefghijklmnopqrstuvwxyz";
const HEX = "0123456789abcdef";

/**
 * Drawn once per run, after the decision to run, and never given to a framework. The echo
 * rows write these back, and the values have to be ones a framework could not have known.
 */
export const runValues = {
  one: int(4),
  two: int(4),
  tenant: string(12, LOWER),
  requestId: string(16, HEX),
  account: int(6),
  page: int(3),
  size: int(2),
  status: choice(["open", "paid", "shipped", "cancelled"]),
  category: choice(CATEGORIES),
  sort: choice(["name", "created", "total"]),
  q: words(2, 5, LOWER),
  minPrice: int(4),
  maxPrice: int(5),
} satisfies { readonly [K in keyof RunValues]: Value<RunValues[K]> };

function shapeOf<D extends Record<string, Value<unknown>>>(declared: D): { [K in keyof D]: D[K]["schema"] } {
  return Object.fromEntries(Object.entries(declared).map(([name, value]) => [name, value.schema])) as {
    [K in keyof D]: D[K]["schema"];
  };
}

/** A run's values drawn somewhere else, such as by the run that hands the same ones to every client. */
export const runValuesSchema = z.strictObject(shapeOf(runValues));

/**
 * One run's values. Parsed on the way out, so a draw that strays outside its own schema
 * fails here rather than in whatever reads the schema next.
 */
export function drawRunValues(random: () => number): RunValues {
  const drawn: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(runValues)) drawn[name] = value.draw(random);
  return runValuesSchema.parse(drawn);
}

/** The `Draw` a client hands a test, with every pick made from `random`. */
export function drawFrom(random: () => number): Draw {
  return {
    choice: <T>(values: readonly T[]): T => values[pick(random, values.length)] as T,
    item: () => 1 + pick(random, LARGE),
  };
}
