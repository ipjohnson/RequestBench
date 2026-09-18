/**
 * headers: reading request headers, at a few and at many.
 *
 * The header count is the variable and the body is fixed, so a target that stopped reading
 * headers at some limit would answer this correctly and still be wrong. What a response can
 * hold is that the request was accepted with all of them attached, which is what these do.
 */
import * as floor from "./floor.js";
import * as planned from "./planned.js";
import { send } from "./supertest.js";

describe("headers", () => {
  // rb:test headers.few
  it("a request carrying a few headers is served", async () => {
    const a = planned.ask("headers.few");

    const answer = await send(a);

    floor.check(a, answer);
  });

  // rb:test headers.many
  it("and one carrying many is served the same way", async () => {
    const a = planned.ask("headers.many");

    const answer = await send(a);

    floor.check(a, answer);
  });
});
