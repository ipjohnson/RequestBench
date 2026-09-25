// Each framework's error declaration: the default export of the client-exception/index.ts beside
// its rb.json. The directory is the framework's identity, so the declaration is found there and
// nothing lists it.
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import type { Exceptions } from "@rb/tests/kit";
import { frameworkDir, type FrameworkKey } from "./bundle.ts";
import type { LoadedFramework } from "./manifest.ts";

/** A framework with the declaration its refusals are read through, as the gate and the load need it. */
export interface DeclaredFramework extends LoadedFramework {
  readonly exceptions: Exceptions;
}

/** Where a framework's declaration is, from the repository's root. */
export const declarationOf = (f: FrameworkKey): string => `${frameworkDir(f)}/client-exception/index.ts`;

const STATUSES = ["rejected", "malformed", "notFound", "wrongMethod"] as const;

/** Whether a module's default export is what the kit's exceptions() returns. */
function isExceptions(v: unknown): v is Exceptions {
  if (v === null || typeof v !== "object") return false;
  const d = v as Record<string, unknown>;
  return (
    typeof d["about"] === "string" &&
    STATUSES.every((status) => Number.isInteger(d[status])) &&
    (d["reports"] === "all" || d["reports"] === "first") &&
    typeof d["read"] === "function"
  );
}

/** The framework's declaration, imported from its directory. */
export async function exceptionsOf(root: string, f: FrameworkKey): Promise<Exceptions> {
  const file = declarationOf(f);
  let module: { default?: unknown };
  try {
    module = (await import(pathToFileURL(join(root, file)).href)) as { default?: unknown };
  } catch (error) {
    throw new Error(`${file} does not load: ${(error as Error).message}`);
  }
  if (!isExceptions(module.default)) throw new Error(`${file} does not default-export a declaration made with the kit's exceptions()`);
  return module.default;
}

export async function withExceptions(root: string, f: LoadedFramework): Promise<DeclaredFramework> {
  return { ...f, exceptions: await exceptionsOf(root, f) };
}
