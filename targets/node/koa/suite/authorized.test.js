/**
 * authorized: one endpoint that refuses, and one that does not.
 *
 * The pair is the test. A target that let everything through would pass the allowed case and
 * nothing else, so the denial is what carries the family, and its envelope is the
 * framework's own rather than this repository's.
 */
import * as envelope from "./envelope.js";
import * as floor from "./floor.js";
import * as planned from "./planned.js";
import { send } from "./supertest.js";

const TARGET = "node:koa";

describe("authorized", () => {
  // rb:test authorized.allowed
  it("a request carrying the token is served", async () => {
    const a = planned.ask("authorized.allowed");

    const answer = await send(a);

    floor.check(a, answer);
  });

  // rb:test authorized.denied
  it("a request with the wrong token is refused in the frameworks own shape", async () => {
    const a = planned.ask("authorized.denied");

    const answer = await send(a);

    envelope.check(a, answer, TARGET);
  });
});
