// Which schema judges a target's answer on an error endpoint.
//
// Every implemented target is named here rather than discovered, so a target added to
// spec/matrix.json without a client-exception package is a compile error and not a silent
// fall-through to something more forgiving. There is no default: a framework that has not
// said what it answers is not gated on a guess.
import {
  declaredStatuses, schemaAt, shapeOf,
  type Answer, type Ask, type ExceptionPackage, type Resolved,
} from "@rb/schema";
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

/** What one target declared for one error endpoint: one schema, or one per status. */
export function schemaFor(ask: Ask): Resolved | null {
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
 *
 * A framework that declared one envelope per status is judged by the branch for the status
 * that arrived. Answering a status it never declared fails and says so, because which layer
 * a body failed at is the thing the status is carrying.
 */
export function errorProblem(ask: Ask, answer: Answer): string | null {
  const declared = schemaFor(ask);
  if (!declared) {
    const answered = [...shapeOf(answer.body)].sort().join(", ") || "an empty body";
    return `${ask.target} declares no error contract for ${ask.endpoint} (answered ${answered})`;
  }
  return problemAgainst(declared, ask, answer);
}

/**
 * Why this answer does not satisfy one declaration, or null.
 *
 * Split out from errorProblem so the branch selection can be tested before any framework
 * declares more than one status. Once #35 moves the frameworks whose binder and validator
 * fail at different layers, this is the path that decides which envelope they are held to.
 */
export function problemAgainst(declared: Resolved, ask: Ask, answer: Answer): string | null {
  const answered = [...shapeOf(answer.body)].sort().join(", ") || "an empty body";
  const schema = schemaAt(declared, answer.status);
  if (!schema) {
    const known = declaredStatuses(declared).join(", ");
    return `answered ${answer.status}, which ${ask.target} does not declare for `
      + `${ask.endpoint} (it declares ${known}; answered ${answered})`;
  }
  const parsed = schema.safeParse(answer);
  if (parsed.success) return null;
  const issue = parsed.error.issues[0];
  if (!issue) return `does not match the declared envelope (answered ${answered})`;
  const where = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
  return `${where}${issue.message} (answered ${answered})`;
}
