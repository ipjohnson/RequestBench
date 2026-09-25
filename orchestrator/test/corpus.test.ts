// Every test in the corpus, shown to pass a correct answer and to fail each wrong
// answer it exists to refuse.
//
// The correct answer is never written here. It comes from the reference, which
// computes each answer from the request and the published payloads rather than from
// what the test expects, and answers each error in the words of one of the error
// contracts in contracts.ts. The wrong answers come from the test's own assertions, one mistake per
// assertion, and each has to fail on that assertion alone.
//
// Every case sends the test twice on one session, because freshness and replay are
// relations between two answers. The mistake is made on the second.
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import suite from "@rb/tests";
import type { Test } from "@rb/tests/kit";
import { recorder } from "../record.ts";
import { validator, type Failure, type Response, type Transport } from "../validate.ts";
import { CONTRACTS } from "./contracts.ts";
import { mistakesFor, type Mistake } from "./mutations.ts";
import { corpusReference, DRAW, REFUSALS, RUN, type Contract } from "./reference.ts";

/** A row whose answer declares nothing of the contract's answers the same whichever is asked, so it is asked of one. */
const ANY = CONTRACTS[0]!;

const references = new Map(CONTRACTS.map((c) => [c.id, corpusReference(c)]));

/** Assertions whose right answer is read from the contract's declaration, so each contract is asked. */
const DECLARED = new Set(["rejected", "unparseable", "notFound", "wrongMethod"]);

interface Outcome {
  readonly first: Failure[];
  readonly second: Failure[];
  readonly unsent: number;
}

async function twice(t: Test, contract: Contract, transport: Transport, turn = () => {}): Promise<Outcome> {
  const session = validator({ transport, exceptions: contract.declared, run: RUN, draw: DRAW });
  await t.request(session.client);
  const first = session.failures.splice(0);
  turn();
  await t.request(session.client);
  const second = session.failures.splice(0);
  return { first, second, unsent: session.unsent() };
}

/** The reference, with the mistake made on every answer after `turn`. */
function mistaken(inner: Transport, mistake: Mistake) {
  let second = false;
  const seen = new Map<string, Response>();
  const transport: Transport = async (req) => {
    const r = await inner(req);
    const key = `${req.method} ${req.target}`;
    if (!second) {
      seen.set(key, r);
      return r;
    }
    return mistake.apply(r, seen.get(key));
  };
  return { transport, turn: () => void (second = true) };
}

const show = (fs: readonly Failure[]) => fs.map((f) => `${f.kind}: ${f.message}`).join("\n");

async function assertsOf(t: Test) {
  const { client, recording } = recorder();
  await t.request(client);
  return recording.calls.filter((c) => !c.priming).at(-1)?.asserts ?? [];
}

for (const [id, t] of Object.entries(suite.tests)) {
  const asserts = await assertsOf(t);
  const each = REFUSALS.has(id) || asserts.some((a) => DECLARED.has(a.kind));
  const mistakes = asserts.flatMap(mistakesFor);

  describe(id, () => {
    for (const contract of each ? CONTRACTS : [ANY]) {
      const label = each ? `, as ${contract.id}` : "";
      const reference = references.get(contract.id)!;

      test(`passes the reference answer${label}`, async () => {
        const o = await twice(t, contract, reference.transport());
        assert.equal(show([...o.first, ...o.second]), "", "the reference answer failed");
        assert.equal(o.unsent, 0, "a call was built and never sent");
      });

      for (const m of mistakes) {
        test(`fails on ${m.breaks} when ${m.what}${label}`, async (ctx) => {
          const x = mistaken(reference.transport(), m);
          const o = await twice(t, contract, x.transport, x.turn);
          if (o.first.length > 0) {
            ctx.skip("the reference answer already fails here, so a mistake proves nothing");
            return;
          }
          assert.deepEqual(
            o.second.map((f) => f.kind),
            [m.breaks],
            o.second.length === 0 ? "nothing failed" : `failed on something else:\n${show(o.second)}`,
          );
        });
      }
    }
  });
}
