import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/** One row of items.large, and of every payload made from it. */
export interface Item {
  readonly id: number;
  readonly name: string;
  readonly category: string;
  readonly priceCents: number;
  readonly inStock: boolean;
}

/** items.small, items.medium or items.large. */
export interface Payload {
  readonly size: string;
  readonly count: number;
  readonly items: readonly Item[];
}

/**
 * The committed payloads, read from the directory RB_PAYLOADS names before the server starts,
 * so a missing or broken file stops the boot rather than failing a request. The parsed objects
 * are kept and serialised on every request.
 */
export interface Payloads {
  /** Absolute, because @koa/send serves it. */
  readonly directory: string;
  readonly small: Payload;
  readonly medium: Payload;
  readonly large: Payload;
  /** The row of items.large with this id, or undefined when there is none. */
  row(id: number): Item | undefined;
}

export function load(directory: string): Payloads {
  const dir = resolve(directory);
  const read = <T>(file: string): T => JSON.parse(readFileSync(join(dir, file), "utf8")) as T;
  const large = read<Payload>("items.large.json");
  const rows = new Map(large.items.map((row) => [row.id, row]));
  return {
    directory: dir,
    small: read("items.small.json"),
    medium: read("items.medium.json"),
    large,
    row: (id) => rows.get(id),
  };
}
