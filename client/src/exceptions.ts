// Which schema judges a target's answer on an error endpoint.
//
// Every implemented target is named here rather than discovered, so a target added to
// spec/matrix.json without a client-exception package is a compile error and not a silent
// fall-through to something more forgiving. There is no default: a framework that has not
// said what it answers is not gated on a guess.
import { shapeOf, type Answer, type Ask, type ExceptionPackage, type z } from "@rb/schema";
import dotnetAspnetMvc from "@rb/client-exception-dotnet-aspnet-mvc";
import dotnetCarter from "@rb/client-exception-dotnet-carter";
import dotnetFastendpoints from "@rb/client-exception-dotnet-fastendpoints";
import dotnetMinimalApis from "@rb/client-exception-dotnet-minimal-apis";
import dotnetWolverineHttp from "@rb/client-exception-dotnet-wolverine-http";
import goChi from "@rb/client-exception-go-chi";
import goEcho from "@rb/client-exception-go-echo";
import goFiber from "@rb/client-exception-go-fiber";
import goGin from "@rb/client-exception-go-gin";
import goGorillaMux from "@rb/client-exception-go-gorilla-mux";
import javaHelidonSe from "@rb/client-exception-java-helidon-se";
import javaJavalin from "@rb/client-exception-java-javalin";
import javaMicronaut from "@rb/client-exception-java-micronaut";
import javaQuarkus from "@rb/client-exception-java-quarkus";
import javaSpringBoot from "@rb/client-exception-java-spring-boot";
import javaVertx from "@rb/client-exception-java-vertx";
import nodeExpress from "@rb/client-exception-node-express";
import nodeFastify from "@rb/client-exception-node-fastify";
import nodeH3 from "@rb/client-exception-node-h3";
import nodeHono from "@rb/client-exception-node-hono";
import nodeKoa from "@rb/client-exception-node-koa";
import pythonDjangoAsgi from "@rb/client-exception-python-django-asgi";
import pythonFastapi from "@rb/client-exception-python-fastapi";
import pythonFlask from "@rb/client-exception-python-flask";
import pythonLitestar from "@rb/client-exception-python-litestar";
import pythonSanic from "@rb/client-exception-python-sanic";
import pythonStarlette from "@rb/client-exception-python-starlette";
import rustActixWeb from "@rb/client-exception-rust-actix-web";
import rustAxum from "@rb/client-exception-rust-axum";
import rustPoem from "@rb/client-exception-rust-poem";
import rustRocket from "@rb/client-exception-rust-rocket";
import rustSalvo from "@rb/client-exception-rust-salvo";
import rustWarp from "@rb/client-exception-rust-warp";

const PACKAGES: readonly ExceptionPackage[] = [
  dotnetAspnetMvc,
  dotnetCarter,
  dotnetFastendpoints,
  dotnetMinimalApis,
  dotnetWolverineHttp,
  goChi,
  goEcho,
  goFiber,
  goGin,
  goGorillaMux,
  javaHelidonSe,
  javaJavalin,
  javaMicronaut,
  javaQuarkus,
  javaSpringBoot,
  javaVertx,
  nodeExpress,
  nodeFastify,
  nodeH3,
  nodeHono,
  nodeKoa,
  pythonDjangoAsgi,
  pythonFastapi,
  pythonFlask,
  pythonLitestar,
  pythonSanic,
  pythonStarlette,
  rustActixWeb,
  rustAxum,
  rustPoem,
  rustRocket,
  rustSalvo,
  rustWarp,
];

const BY_TARGET = new Map(PACKAGES.map((p) => [p.target, p]));

/** Every target's declared error contract, for the scenario pages and for the tests. */
export const declaredExceptions = (): readonly ExceptionPackage[] => PACKAGES;

/** The schema one target declared for one error endpoint, or null if it declared none. */
export function schemaFor(ask: Ask): z.ZodType<unknown> | null {
  const declared = BY_TARGET.get(ask.target)?.schemas[ask.endpoint];
  return declared ? declared(ask) : null;
}

/**
 * Why this answer is not what the target's own package says it answers, or null.
 *
 * A target with no package, or no schema for this endpoint, is a failure rather than a
 * pass. The gate cannot report drift on an error body -- two frameworks disagreeing there
 * is the point -- so a declared schema is the only thing standing between a changed
 * envelope and nobody noticing.
 */
export function errorProblem(ask: Ask, answer: Answer): string | null {
  const schema = schemaFor(ask);
  if (!schema) {
    return `${ask.target} declares no error contract for ${ask.endpoint} ` +
      `(answered ${[...shapeOf(answer.body)].sort().join(", ") || "an empty body"})`;
  }
  const parsed = schema.safeParse(answer);
  if (parsed.success) return null;
  const issue = parsed.error.issues[0];
  if (!issue) return "does not match the declared envelope";
  const where = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
  const shape = [...shapeOf(answer.body)].sort().join(", ");
  return `${where}${issue.message} (answered ${shape || "an empty body"})`;
}
