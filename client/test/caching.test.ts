// The two caching families, against stub targets that get them right and wrong.
//
// Both families ride on one header, x-rb-serial, read in opposite directions: the etag rows
// require it to advance, because a shallow validator still runs the handler, and the cache
// rows require it to repeat, because a stored response is the feature. Neither reading is
// checkable against a committed file, so the evidence is a target that behaves and a target
// that does not.
import { afterAll, describe, expect, test } from "vitest";
import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import { gate } from "../src/gate.js";
import type { Plan } from "../src/spec.js";

const INSTANCES = 8;
const times = (path: string): string[] => Array.from({ length: INSTANCES }, () => path);
const LARGE = JSON.stringify({ size: "large", count: 2, items: [1, 2] });
const SMALL = JSON.stringify({ size: "small", count: 1, items: [1] });

const plan: Plan = {
  version: "blend-v2",
  instances: INSTANCES,
  captures: { etag_large: { method: "GET", path: "/etag/large", header: "etag" } },
  endpoints: [
    { id: "etag.large", family: "etag", method: "GET", expect: 200, paths: times("/etag/large") },
    {
      id: "etag.match_large", family: "etag", method: "GET", expect: 304,
      paths: times("/etag/large"), headers: { "if-none-match": "{capture.etag_large}" },
    },
    {
      id: "etag.stale_large", family: "etag", method: "GET", expect: 200,
      paths: times("/etag/large"), headers: { "if-none-match": '"0000000000000000"' },
    },
    { id: "cache.small", family: "cache", method: "GET", expect: 200, paths: times("/cache/small") },
    {
      id: "cache.vary_one", family: "cache", method: "GET", expect: 200,
      paths: times("/cache/vary/one"),
      header_variants: [{ "accept-language": "en" }, { "accept-language": "fr" }],
    },
  ],
};

type Faults = {
  /** Emit no ETag at all, so the capture has nothing to read. */
  readonly noEtag?: boolean;
  /** Answer every request from the handler, so nothing is ever replayed. */
  readonly noStore?: boolean;
  /** Store one entry per path, ignoring the header the row varies. */
  readonly ignoresVary?: boolean;
  /** Replay the stored bytes under the type a store defaults to rather than the handler's. */
  readonly forgetsType?: boolean;
};

const servers: Server[] = [];

/**
 * A target whose ETag is computed from the body it is about to send and whose cache stores
 * the whole response, serial included. That is what a framework's own machinery does, and
 * each fault below removes one piece of it.
 */
async function serve(faults: Faults = {}): Promise<string> {
  let serial = 0;
  const store = new Map<string, { body: string; serial: string }>();
  const server = createServer((req, res) => {
    const path = (req.url ?? "").split("?")[0] ?? "";
    req.resume();
    req.on("end", () => {
      const send = (status: number, body: string, extra: Record<string, string> = {}): void => {
        const buf = Buffer.from(body);
        res.writeHead(status, status === 304 ? extra : {
          "content-type": "application/json", "content-length": buf.length, ...extra,
        });
        res.end(status === 304 ? undefined : buf);
      };
      if (path === "/__meta") return send(200, "{}");
      if (path === "/etag/large") {
        const etag = faults.noEtag ? null : `"${createHash("sha1").update(LARGE).digest("hex").slice(0, 16)}"`;
        const headers = { "x-rb-serial": String(++serial), ...(etag ? { etag } : {}) };
        if (etag !== null && req.headers["if-none-match"] === etag) return send(304, "", headers);
        return send(200, LARGE, headers);
      }
      const key = faults.ignoresVary ? path : `${path}|${req.headers["accept-language"] ?? ""}`;
      const hit = faults.noStore ? undefined : store.get(key);
      if (hit) {
        if (faults.forgetsType) {
          const buf = Buffer.from(hit.body);
          res.writeHead(200, {
            "content-type": "application/octet-stream",
            "content-length": buf.length, "x-rb-serial": hit.serial,
          });
          return res.end(buf);
        }
        return send(200, hit.body, { "x-rb-serial": hit.serial });
      }
      const fresh = { body: SMALL, serial: String(++serial) };
      store.set(key, fresh);
      return send(200, fresh.body, { "x-rb-serial": fresh.serial });
    });
  });
  servers.push(server);
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("no port");
  return `127.0.0.1:${address.port}`;
}

const why = (r: Awaited<ReturnType<typeof gate>>, id: string): string | null =>
  r.endpoints.find((e) => e.id === id)?.why ?? null;

afterAll(() => { for (const s of servers) s.close(); });

describe("a target that runs both facilities", () => {
  test("every endpoint conforms", async () => {
    const r = await gate(plan, await serve(), "node:fastify");
    expect(r.endpoints.filter((e) => !e.ok).map((e) => [e.id, e.why])).toEqual([]);
  });

  test("the conditional arm is answered 304 with the tag the target chose", async () => {
    const r = await gate(plan, await serve(), "node:fastify");
    expect([...(r.endpoints.find((e) => e.id === "etag.match_large")?.seen ?? [])])
      .toEqual([[304, INSTANCES]]);
    const sent = r.exemplars.find((e) => e.endpoint === "etag.match_large")?.request.headers;
    expect(sent?.find(([k]) => k === "if-none-match")?.[1]).toMatch(/^"[0-9a-f]{16}"$/);
  });

  test("the stale arm is answered in full, because no digest produces sixteen zeros", async () => {
    const r = await gate(plan, await serve(), "node:fastify");
    expect([...(r.endpoints.find((e) => e.id === "etag.stale_large")?.seen ?? [])])
      .toEqual([[200, INSTANCES]]);
  });
});

describe("a target that gets one piece wrong", () => {
  test("no ETag at all: the capture has nothing to read and the arm is never sent", async () => {
    const r = await gate(plan, await serve({ noEtag: true }), "node:fastify");
    expect(why(r, "etag.match_large")).toBe(
      "capture etag_large was never resolved, so if-none-match cannot be sent");
    // The rows that do not depend on the capture still answer, so the failure is one row.
    expect(r.endpoints.filter((e) => !e.ok).map((e) => e.id)).toEqual(["etag.match_large"]);
  });

  test("no store: the serial advances where a replayed response would repeat it", async () => {
    const r = await gate(plan, await serve({ noStore: true }), "node:fastify");
    expect(why(r, "cache.small")).toContain("the handler ran again, so nothing was replayed");
    expect(why(r, "cache.vary_one")).toContain("the handler ran again");
  });

  test("a replay that loses the content type is caught, though the first response is not", async () => {
    const r = await gate(plan, await serve({ forgetsType: true }), "node:fastify");
    // The row still conforms: the bytes and the counter are right, and the handler was
    // skipped. What is wrong is the response the store wrote back, which is why the
    // complaint says so rather than reading as a failure of the first one.
    expect(why(r, "cache.small")).toBeNull();
    expect(r.headerProblems.map(([, msg]) => msg))
      .toContain("replayed: JSON body served as application/octet-stream");
  });

  test("a store that ignores the vary header answers fewer responses than keys", async () => {
    const r = await gate(plan, await serve({ ignoresVary: true }), "node:fastify");
    expect(why(r, "cache.vary_one")).toBe(
      "2 distinct cache key(s) sent, 1 stored response(s) answered "
      + "(the store is not keyed on everything the row varies)");
    // The row keyed by path alone is unaffected, so the check is about the vary and not
    // about caching in general.
    expect(why(r, "cache.small")).toBeNull();
  });
});
