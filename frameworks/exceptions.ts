import type { Exceptions } from "@rb/tests/kit";

import aspnetMvc from "./dotnet/aspnet-mvc/client-exception/index.ts";
import axum from "./rust/axum/client-exception/index.ts";
import carter from "./dotnet/carter/client-exception/index.ts";
import fastapi from "./python/fastapi/client-exception/index.ts";
import fastendpoints from "./dotnet/fastendpoints/client-exception/index.ts";
import fastify from "./node/fastify/client-exception/index.ts";
import gin from "./go/gin/client-exception/index.ts";
import helidonSe from "./java/helidon-se/client-exception/index.ts";
import javalin from "./java/javalin/client-exception/index.ts";
import micronaut from "./java/micronaut/client-exception/index.ts";
import minimalApis from "./dotnet/minimal-apis/client-exception/index.ts";
import quarkus from "./java/quarkus/client-exception/index.ts";
import springBoot from "./java/spring-boot/client-exception/index.ts";
import vertx from "./java/vertx/client-exception/index.ts";
import wolverineHttp from "./dotnet/wolverine-http/client-exception/index.ts";

/**
 * Generated from discovery once the orchestrator exists, so a framework with an
 * rb.json and no line here is a compile error naming the missing key rather
 * than a run that falls over on the first rejection row.
 */
export type FrameworkId =
  | "dotnet:aspnet-mvc"
  | "dotnet:carter"
  | "dotnet:fastendpoints"
  | "dotnet:minimal-apis"
  | "dotnet:wolverine-http"
  | "go:gin"
  | "java:helidon-se"
  | "java:javalin"
  | "java:micronaut"
  | "java:quarkus"
  | "java:spring-boot"
  | "java:vertx"
  | "node:fastify"
  | "python:fastapi"
  | "rust:axum";

/**
 * The one central list the contract does not remove. Discovery finds frameworks
 * by scanning tracked files; a static import is what gives these declarations
 * their types, and the two want different things. It lives beside what it
 * registers so it is in the diff that adds one.
 */
export default {
  "dotnet:aspnet-mvc": aspnetMvc,
  "dotnet:carter": carter,
  "dotnet:fastendpoints": fastendpoints,
  "dotnet:minimal-apis": minimalApis,
  "dotnet:wolverine-http": wolverineHttp,
  "go:gin": gin,
  "java:helidon-se": helidonSe,
  "java:javalin": javalin,
  "java:micronaut": micronaut,
  "java:quarkus": quarkus,
  "java:spring-boot": springBoot,
  "java:vertx": vertx,
  "node:fastify": fastify,
  "python:fastapi": fastapi,
  "rust:axum": axum,
} satisfies Record<FrameworkId, Exceptions>;
