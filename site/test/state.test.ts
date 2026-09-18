// A row's framework page and the way back: the row's link carries the explorer's view in its
// query, and the page's link back has to put it where the explorer reads it.
import { describe, expect, test } from "vitest";
import { backHref, initialState, pageHref, readHash, writeHash } from "../src/client/state.js";

const langs = ["go", "node", "rust"];
const searchOf = (href: string): string => new URL(href, "https://example.org/").search;

describe("a row's framework page", () => {
  test("opens on the family or endpoint the row is", () => {
    const st = initialState("container", langs);
    expect(pageHref("f/go-gin.html", "domain", st, langs, null)).toMatch(/^f\/go-gin\.html\?.+#domain$/);
    expect(pageHref("f/go-gin.html", "domain.lookup", st, langs, null)).toMatch(/#domain\.lookup$/);
    expect(pageHref("f/go-gin.html", "", st, langs, null)).not.toContain("#");
  });

  test("links back to the view the row was in", () => {
    const st = initialState("container", langs);
    st.gran = "family";
    st.rung = "2";
    st.metric = "p99_us";
    st.q = "dom";
    st.langs = new Set(["go", "rust"]);
    st.sort = { col: "n", dir: -1 };
    const href = pageHref("f/go-gin.html", "domain", st, langs, null);
    expect(backHref("../index.html", searchOf(href))).toBe(`../index.html${writeHash(st, langs)}`);
  });

  test("puts a results base back in the query, where the explorer reads it", () => {
    const st = initialState("container", langs);
    st.gran = "endpoint";
    const href = pageHref("f/go-gin.html", "json.small", st, langs, "https://example.org/results/");
    const back = new URL(backHref("../index.html", searchOf(href)), "https://example.org/f/");
    expect(back.pathname).toBe("/index.html");
    expect(back.searchParams.get("data")).toBe("https://example.org/results/");
    const round = initialState("lambda-rie", langs);
    readHash(round, back.hash);
    expect(round).toEqual(st);
  });

  test("a page opened on its own links back to the default view", () => {
    expect(backHref("../index.html", "")).toBe("../index.html");
  });
});
