// The delta cell, which both kinds of page draw, and the chain it belongs to.
//
// They are strings rather than components because the explorer writes the cell into
// innerHTML, and a component that only ever produced a string would be a wrapper.
import type { Chain, Step } from "./delta.js";
import { floorFor } from "./delta.js";
import { esc } from "./html.js";
import { signed, type Unit } from "./metrics.js";

/**
 * The number, and grey with the reason when it is smaller than the instrument can see.
 *
 * Takes either a whole chain, whose delta is `total` against `root`, or one of its steps,
 * whose delta is `d` against `base`.
 */
export function deltaCell(x: Chain | Step | null | undefined, unit: Unit): string {
  if (!x) return `<td class="delta root" title="This endpoint carries no base.">&mdash;</td>`;
  const v = "total" in x ? x.total : x.d;
  const against = "root" in x ? x.root : x.base;
  const state = !x.measurable ? "flat" : v > 0 ? "up" : "down";
  const why = x.measurable
    ? `${signed(v, unit)} over ${against}`
    : `${signed(v, unit)} is inside the ${Math.round(floorFor(x.arm_v, x.base_v))}` +
      `${unit ? ` ${unit}` : ""} the histogram can resolve at this magnitude, so this factor ` +
      `adds no measurable time`;
  return `<td class="delta ${state}" title="${esc(why)}">${signed(v, unit)}</td>`;
}

/**
 * What this endpoint costs over its base, one row per factor, ending in the total over the
 * root. The rows sum to the total exactly, because every one of them is a difference of two
 * numbers on this page and the middles cancel.
 */
export function chainTable(
  x: Chain | null | undefined,
  factors: Readonly<Record<string, string>>,
  metricLabel: string,
  unit: Unit,
): string {
  if (!x) return "";
  const num = (v: number): string => Math.round(v).toLocaleString();
  const rows = x.steps
    .map(
      (s) => `
    <tr>
      <td class="l factor">${esc(s.factor)}</td>
      <td class="l reads">${esc(factors[s.factor] ?? "")}</td>
      <td class="step">${num(s.base_v)} &rarr; ${num(s.arm_v)}</td>
      ${deltaCell(s, unit)}
    </tr>`,
    )
    .join("");
  const total = `
    <tr class="total">
      <td class="l factor"></td>
      <td class="l reads">everything over ${esc(x.root)}</td>
      <td class="step">${num(x.base_v)} &rarr; ${num(x.arm_v)}</td>
      ${deltaCell(x, unit)}
    </tr>`;
  // Named once under the table rather than per row, because on most endpoints it applies to
  // every row or to none.
  const flat = x.steps.filter((s) => !s.measurable).map((s) => s.factor);
  const note = flat.length
    ? `<p class="nofloor">${esc(flat.join(", "))} ${flat.length === 1 ? "adds" : "add"} no ` +
      `measurable time: the difference is smaller than the 2% buckets the histogram is read ` +
      `off, so what it shows is the grid.</p>`
    : "";
  return `<h3 class="childcap">What it costs over its base</h3>
    <div class="scroll"><table class="chain"><thead><tr>
      <th class="l">factor</th><th class="l">what it adds</th>
      <th>${esc(metricLabel)}</th><th>delta</th>
    </tr></thead><tbody>${rows}${total}</tbody></table></div>${note}`;
}
