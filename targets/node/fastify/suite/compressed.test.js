/**
 * compressed: outbound gzip, the cost of the wiring declining and the cost of it working.
 *
 * The family a test client can quietly fail to reach. Where a target compresses inside the
 * application an in-process client still runs the codec; where the compression belongs to the
 * server underneath, no in-process client reaches it and the only honest test is one over a real port.
 *
 * The second trap is the client. Some of the clients here decode gzip before the body is
 * read, so a test reading the decoded body would pass every assertion below against an identity
 * response. The send helper beside these tests says whether this one does.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as floor from "./floor.js";
import * as planned from "./planned.js";
import { send } from "./inject.js";

// rb:test compressed.identity_small
test("a client that will not take gzip is answered in full", async () => {
  const a = planned.ask("compressed.identity_small");

  const answer = await send(a);

  floor.check(a, answer);
  assert.equal(answer.encoding, "");
});

// rb:test compressed.identity_large
test("the large payload is uncompressed too when identity was asked for", async () => {
  const a = planned.ask("compressed.identity_large");

  const answer = await send(a);

  floor.check(a, answer);
  assert.equal(answer.encoding, "");
});

// rb:test compressed.gzip_small
test("a payload under the shared floor is sent uncompressed even so", async () => {
  const a = planned.ask("compressed.gzip_small");

  const answer = await send(a);

  floor.check(a, answer);
  // spec/expected.json pins no encoding here: the small payload sits under the shared
  // gzip floor and the frameworks disagree about what to do with it. What this target
  // does is therefore the suite's to assert, not the expectation's.
  assert.equal(answer.encoding, "");
});

// rb:test compressed.gzip_large
test("a payload over the floor is gzipped and says what it varies on", async () => {
  const a = planned.ask("compressed.gzip_large");

  const answer = await send(a);

  floor.check(a, answer);
  assert.equal(answer.encoding, "gzip");
  // A target that gzips without Vary: Accept-Encoding passes the floor and is wrong in
  // front of any shared cache.
  assert.match(answer.headers.vary ?? "", /accept-encoding/i);
});
