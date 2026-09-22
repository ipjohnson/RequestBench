// The delta cell, which both kinds of page draw, and the rows a framework page's numbers are
// compared against: the base's, and any other framework's.
//
// They are strings rather than components because the explorer writes the cell into
// innerHTML, and the framework page writes another framework's row the same way.
import type { Chain, Step } from "./delta.ts";
import { floorFor } from "./delta.ts";
import { esc } from "./html.ts";
import { signed, withUnit, type Unit } from "./metrics.ts";
import type { Rung } from "./types.ts";

/**
 * Why a framework has no latencies at a rate it did not complete: what it achieved and dropped
 * instead. The rate's button says it, and so does another framework's row at that rate.
 */
export function unfinished(name: string, r: Rung | undefined): string | null {
  if (r?.completed !== false) return null;
  const n = (v: number | undefined): string => (v ?? 0).toLocaleString();
  return (
    `${name} could not sustain ${n(r.rps)} rps. It achieved ${n(r.achievedRps)} rps ` +
    `and dropped ${n(r.dropped)} requests, so there are no latencies at this rate.`
  );
}

/**
 * The number, and grey with the reason when it is smaller than the instrument can see.
 *
 * Takes either a whole chain, whose delta is `total` against `root`, or one of its steps,
 * whose delta is `d` against `base`.
 */
export function deltaCell(x: Chain | Step | null | undefined, unit: Unit): string {
  if (!x) return `<td class="delta root" title="This test carries no base.">&mdash;</td>`;
  const v = "total" in x ? x.total : x.d;
  const against = "root" in x ? x.root : x.base;
  const state = !x.measurable ? "flat" : v > 0 ? "up" : "down";
  const why = x.measurable
    ? `${signed(v, unit)} over ${against}`
    : `${signed(v, unit)} is inside the ${Math.round(floorFor(x.armV, x.baseV))}` +
      `${unit ? ` ${unit}` : ""} the histogram can resolve at this magnitude, so this factor ` +
      `adds no measurable time`;
  return `<td class="delta ${state}" title="${esc(why)}">${signed(v, unit)}</td>`;
}

/**
 * The popup on one of the base's numbers: how far this test's number is from it, then each
 * factor between the two and what it reads as. Over more than one step each factor carries its
 * own share, and the shares sum to the difference exactly.
 *
 * `level` names the percentile, and is empty for a byte count.
 */
export function basePop(x: Chain, unit: Unit, factors: Readonly<Record<string, string>>, level: string): string {
  const many = x.steps.length > 1;
  const steps = x.steps
    .map((s) => {
      const flat = many && !s.measurable;
      const share = many ? `<span${flat ? ' class="flat"' : ""}>${signed(s.d, unit)}</span>` : "";
      const reads = factors[s.factor];
      return (
        `<div class="bpstep"><p class="bpf"><span>${esc(s.factor)}</span>${share}</p>` +
        (reads ? `<p>${esc(reads)}</p>` : "") +
        (flat ? `<p class="bpnote">No measurable time.</p>` : "") +
        `</div>`
      );
    })
    .join("");
  return head(x.total, x.measurable, x.armV, x.baseV, unit, x.root, level) + steps;
}

/**
 * The popup on another framework's number: how far this framework's is from it. The two are
 * the same test at the same rate in the same run, so there are no factors between them to
 * list, only the difference and whether the histogram can resolve it.
 */
export function peerPop(own: number, other: number, unit: Unit, name: string, level: string): string {
  const d = own - other;
  const measurable = unit !== "us" || Math.abs(d) >= floorFor(own, other);
  return head(d, measurable, own, other, unit, name, level);
}

/** A popup's first line, and the note when the difference is inside the histogram's grid. */
function head(d: number, measurable: boolean, arm: number, base: number, unit: Unit, against: string, level: string): string {
  const n = Math.round(d);
  const state = !measurable || n === 0 ? "flat" : n > 0 ? "up" : "down";
  const note =
    measurable || n === 0
      ? ""
      : `<p class="bpnote">Inside the ${withUnit(floorFor(arm, base), unit)} the ` +
        `histogram can resolve at this magnitude, so no measurable time.</p>`;
  return (
    `<p class="bphead"><b class="${state}">${signed(n, unit)}</b> vs ${esc(against)}` +
    `${level ? ` at ${esc(level)}` : ""}</p>${note}`
  );
}

/**
 * One number of something the page is compared with, under the same number of its own, hidden
 * until the comparison picks it. `id` is what it belongs to: `base`, or the other framework's
 * page name. Where the difference can be taken, its popup rides along in a template, which
 * test-tree.ts shows on hover and on focus.
 */
export function cmpCell(id: string, v: string, pop: string | null, title?: string): string {
  const t = title ? ` title="${esc(title)}"` : "";
  if (pop === null) return `<span class="fb" data-cmp="${esc(id)}"${t} hidden>${esc(v)}</span>`;
  return `<span class="fb" data-cmp="${esc(id)}"${t} tabindex="0" hidden>${esc(v)}<template>${pop}</template></span>`;
}

/** One of the base's numbers. The base is the one comparison the page renders itself. */
export function baseCell(
  v: string,
  x: Chain | null | undefined,
  unit: Unit,
  factors: Readonly<Record<string, string>>,
  level: string,
): string {
  return cmpCell("base", v, x ? basePop(x, unit, factors, level) : null);
}
