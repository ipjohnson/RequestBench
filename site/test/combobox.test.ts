// The combobox's list: which choices it keeps as the reader types, and what it marks.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { marked, narrow, type Group } from "../src/client/combobox.ts";

const groups: Group[] = [
  { label: "Families", choices: [{ value: "json" }, { value: "static" }, { value: "stream" }] },
  { label: "Frameworks", choices: [{ value: "express", hint: "node" }, { value: "dotnet-carter", label: "carter" }] },
];

describe("narrow", () => {
  test("with nothing typed, every choice is listed", () => {
    assert.deepEqual(narrow(groups, ""), groups);
    assert.deepEqual(narrow(groups, "  "), groups);
  });

  test("a choice stays when its label holds the text, ignoring case", () => {
    assert.deepEqual(narrow(groups, "RE"), [
      { label: "Families", choices: [{ value: "stream" }] },
      { label: "Frameworks", choices: [{ value: "express", hint: "node" }] },
    ]);
  });

  test("a label is what is matched, not the value behind it", () => {
    assert.deepEqual(narrow(groups, "carter"), [{ label: "Frameworks", choices: [{ value: "dotnet-carter", label: "carter" }] }]);
    assert.deepEqual(narrow(groups, "dotnet"), []);
  });

  test("a group with nothing left goes", () => {
    assert.deepEqual(narrow(groups, "json"), [{ label: "Families", choices: [{ value: "json" }] }]);
  });
});

describe("marked", () => {
  test("the first stretch that matches is marked, in the label's own case", () => {
    assert.equal(marked("static.medium", "M"), "static.<mark>m</mark>edium");
  });

  test("a label with no match, or no text, is only escaped", () => {
    assert.equal(marked("a<b", "z"), "a&lt;b");
    assert.equal(marked("a<b", ""), "a&lt;b");
  });

  test("the marked stretch is escaped too", () => {
    assert.equal(marked("x<y>z", "<y>"), "x<mark>&lt;y&gt;</mark>z");
  });
});
