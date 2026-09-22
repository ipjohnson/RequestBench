// A row's framework page and the way back: the row's link carries the explorer's view in its
// query, and the page's link back has to put it where the explorer reads it.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { backHref, initialState, pageHref, readHash, writeHash } from "../src/client/state.ts";

const langs = ["dotnet", "node", "python"];
const searchOf = (href: string): string => new URL(href, "https://example.org/").search;

describe("a row's framework page", () => {
  test("opens on the family or test the row is", () => {
    const st = initialState("container-h1", langs);
    assert.match(pageHref("f/dotnet-carter.html", "json", st, langs, null), /^f\/dotnet-carter\.html\?.+#json$/);
    assert.match(pageHref("f/dotnet-carter.html", "json.small", st, langs, null), /#json\.small$/);
    assert.ok(!pageHref("f/dotnet-carter.html", "", st, langs, null).includes("#"));
  });

  test("links back to the view the row was in", () => {
    const st = initialState("container-h1", langs);
    st.gran = "family";
    st.rung = "raised";
    st.metric = "p99Us";
    st.q = "jso";
    st.langs = new Set(["dotnet", "python"]);
    st.sort = { col: "n", dir: -1 };
    const href = pageHref("f/dotnet-carter.html", "json", st, langs, null);
    assert.equal(backHref("../index.html", searchOf(href)), `../index.html${writeHash(st, langs)}`);
  });

  test("puts a results base back in the query, where the explorer reads it", () => {
    const st = initialState("container-h1", langs);
    st.gran = "test";
    const href = pageHref("f/dotnet-carter.html", "json.small", st, langs, "https://example.org/results/");
    const back = new URL(backHref("../index.html", searchOf(href)), "https://example.org/f/");
    assert.equal(back.pathname, "/index.html");
    assert.equal(back.searchParams.get("data"), "https://example.org/results/");
    const round = initialState("container-h2", langs);
    readHash(round, back.hash);
    assert.deepEqual(round, st);
  });

  test("a page opened on its own links back to the default view", () => {
    assert.equal(backHref("../index.html", ""), "../index.html");
  });

  test("leaves what the page is compared with on the page", () => {
    const st = initialState("container-h1", langs);
    const href = pageHref("f/dotnet-carter.html", "json.small", st, langs, null);
    const compared = `${searchOf(href)}&vs=base&vs=node-fastify`;
    assert.equal(backHref("../index.html", compared), `../index.html${writeHash(st, langs)}`);
    assert.equal(backHref("../index.html", "?vs=node-fastify"), "../index.html");
  });
});
