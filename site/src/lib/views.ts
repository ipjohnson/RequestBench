// The delta cell, which both kinds of page draw, and the base's row on an endpoint's pane.
//
// They are strings rather than components because the explorer writes the cell into
// innerHTML, and a component that only ever produced a string would be a wrapper.
import type { Chain, Step } from "./delta.js";
import { floorFor } from "./delta.js";
import { esc } from "./html.js";
import { signed, withUnit, type Unit } from "./metrics.js";

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
 * The popup on one of the base's numbers: how far this endpoint's number is from it, then
 * each factor between the two and what it reads as. Over more than one step each factor
 * carries its own share, and the shares sum to the difference exactly.
 *
 * `level` names the percentile, and is empty for a byte count.
 */
export function basePop(
  x: Chain,
  unit: Unit,
  factors: Readonly<Record<string, string>>,
  level: string,
): string {
  const n = Math.round(x.total);
  const state = !x.measurable || n === 0 ? "flat" : n > 0 ? "up" : "down";
  const head =
    `<b class="${state}">${signed(n, unit)}</b> vs ${esc(x.root)}` +
    (level ? ` at ${esc(level)}` : "");
  const note =
    x.measurable || n === 0
      ? ""
      : `<p class="bpnote">Inside the ${withUnit(floorFor(x.arm_v, x.base_v), unit)} the ` +
        `histogram can resolve at this magnitude, so no measurable time.</p>`;
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
  return `<p class="bphead">${head}</p>${note}${steps}`;
}

/**
 * One of the base's numbers, under the same number of the endpoint's own, hidden until the
 * reader opens the comparison. Where the difference can be taken, its popup rides along in a
 * template, which endpoint-tree.ts shows on hover and on focus.
 */
export function baseCell(
  v: string,
  x: Chain | null | undefined,
  unit: Unit,
  factors: Readonly<Record<string, string>>,
  level: string,
): string {
  if (!x) return `<span class="fb" hidden>${esc(v)}</span>`;
  return (
    `<span class="fb" tabindex="0" hidden>${esc(v)}` +
    `<template>${basePop(x, unit, factors, level)}</template></span>`
  );
}
