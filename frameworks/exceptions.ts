import type { Exceptions } from "@rb/tests/kit";

import actixWeb from "./rust/actix-web/client-exception/index.ts";
import aspnetMvc from "./dotnet/aspnet-mvc/client-exception/index.ts";
import axum from "./rust/axum/client-exception/index.ts";
import carter from "./dotnet/carter/client-exception/index.ts";
import chi from "./go/chi/client-exception/index.ts";
import echo from "./go/echo/client-exception/index.ts";
import express from "./node/express/client-exception/index.ts";
import fastapi from "./python/fastapi/client-exception/index.ts";
import fastendpoints from "./dotnet/fastendpoints/client-exception/index.ts";
import fastify from "./node/fastify/client-exception/index.ts";
import fiber from "./go/fiber/client-exception/index.ts";
import gin from "./go/gin/client-exception/index.ts";
import gorillaMux from "./go/gorilla-mux/client-exception/index.ts";
import h3 from "./node/h3/client-exception/index.ts";
import helidonSe from "./java/helidon-se/client-exception/index.ts";
import hono from "./node/hono/client-exception/index.ts";
import javalin from "./java/javalin/client-exception/index.ts";
import koa from "./node/koa/client-exception/index.ts";
import micronaut from "./java/micronaut/client-exception/index.ts";
import minimalApis from "./dotnet/minimal-apis/client-exception/index.ts";
import poem from "./rust/poem/client-exception/index.ts";
import quarkus from "./java/quarkus/client-exception/index.ts";
import rocket from "./rust/rocket/client-exception/index.ts";
import salvo from "./rust/salvo/client-exception/index.ts";
import springBoot from "./java/spring-boot/client-exception/index.ts";
import vertx from "./java/vertx/client-exception/index.ts";
import warp from "./rust/warp/client-exception/index.ts";
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
  | "go:chi"
  | "go:echo"
  | "go:fiber"
  | "go:gin"
  | "go:gorilla-mux"
  | "java:helidon-se"
  | "java:javalin"
  | "java:micronaut"
  | "java:quarkus"
  | "java:spring-boot"
  | "java:vertx"
  | "node:express"
  | "node:fastify"
  | "node:h3"
  | "node:hono"
  | "node:koa"
  | "python:fastapi"
  | "rust:actix-web"
  | "rust:axum"
  | "rust:poem"
  | "rust:rocket"
  | "rust:salvo"
  | "rust:warp";

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
  "go:chi": chi,
  "go:echo": echo,
  "go:fiber": fiber,
  "go:gin": gin,
  "go:gorilla-mux": gorillaMux,
  "java:helidon-se": helidonSe,
  "java:javalin": javalin,
  "java:micronaut": micronaut,
  "java:quarkus": quarkus,
  "java:spring-boot": springBoot,
  "java:vertx": vertx,
  "node:express": express,
  "node:fastify": fastify,
  "node:h3": h3,
  "node:hono": hono,
  "node:koa": koa,
  "python:fastapi": fastapi,
  "rust:actix-web": actixWeb,
  "rust:axum": axum,
  "rust:poem": poem,
  "rust:rocket": rocket,
  "rust:salvo": salvo,
  "rust:warp": warp,
} satisfies Record<FrameworkId, Exceptions>;
