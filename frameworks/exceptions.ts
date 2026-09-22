import type { Exceptions } from "@rb/tests/kit";

import carter from "./dotnet/carter/client-exception/index.ts";
import fastapi from "./python/fastapi/client-exception/index.ts";
import fastify from "./node/fastify/client-exception/index.ts";
import springBoot from "./java/spring-boot/client-exception/index.ts";

/**
 * Generated from discovery once the orchestrator exists, so a framework with an
 * rb.json and no line here is a compile error naming the missing key rather
 * than a run that falls over on the first rejection row.
 */
export type FrameworkId = "dotnet:carter" | "java:spring-boot" | "node:fastify" | "python:fastapi";

/**
 * The one central list the contract does not remove. Discovery finds frameworks
 * by scanning tracked files; a static import is what gives these declarations
 * their types, and the two want different things. It lives beside what it
 * registers so it is in the diff that adds one.
 */
export default {
  "dotnet:carter": carter,
  "java:spring-boot": springBoot,
  "node:fastify": fastify,
  "python:fastapi": fastapi,
} satisfies Record<FrameworkId, Exceptions>;
