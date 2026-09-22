// What the measurement machine is, and whether it is set up to be measured on. A port of
// upstream's harness/machine.py.
//
// Absolute times only reproduce while the machine holds still, so what makes it hold still is
// read from the machine rather than trusted to a runbook: SMT off, a fixed clock, and the
// framework and the generator on separate isolated cores. The state is recorded on every run.
// Nothing requires it yet, because no machine that measures today can pass it.
import { readFileSync } from "node:fs";
import os from "node:os";

const CPU = "/sys/devices/system/cpu";

const read = (path: string, fallback = ""): string => {
  try {
    return readFileSync(path, "utf8").trim();
  } catch {
    return fallback;
  }
};

/** The kernel's `0-3,8` list format as a set. */
export function cpuList(spec: string | undefined): Set<number> {
  const out = new Set<number>();
  for (const part of (spec ?? "").split(",").map((p) => p.trim()).filter((p) => p !== "")) {
    const [lo, hi] = part.split("-").map(Number);
    for (let c = lo!; c <= (hi ?? lo!); c++) out.add(c);
  }
  return out;
}

const show = (cpus: ReadonlySet<number>) => [...cpus].sort((a, b) => a - b).join(",");

export type MachineState =
  | { readonly available: false; readonly cpu: string; readonly cores: number; readonly platform: string }
  | {
      readonly available: true;
      readonly cpu: string;
      readonly cores: number;
      readonly platform: string;
      readonly online: string;
      readonly isolated: string;
      readonly smt: string;
      readonly smtActive: string;
      readonly driver: string;
      readonly governors: readonly string[];
      readonly boostOn: boolean | null;
      readonly thp: string;
      readonly cmdline: string;
      readonly sutCpus: string;
      readonly genCpus: string;
      readonly clock: { readonly minKhz: number; readonly maxKhz: number; readonly spread: number } | null;
    };

/** How far the clock moved while it was watched: governor and boost say what was configured, this says what happened. */
async function clockSpread(cpus: ReadonlySet<number>, samples = 10, gapMs = 50) {
  const seen: number[] = [];
  for (let i = 0; i < samples; i++) {
    for (const c of cpus) {
      const khz = read(`${CPU}/cpu${c}/cpufreq/scaling_cur_freq`);
      if (/^\d+$/.test(khz)) seen.push(Number(khz));
    }
    await new Promise((r) => setTimeout(r, gapMs));
  }
  if (seen.length === 0) return null;
  const lo = Math.min(...seen);
  const hi = Math.max(...seen);
  return { minKhz: lo, maxKhz: hi, spread: hi === 0 ? 0 : Number(((hi - lo) / hi).toFixed(4)) };
}

export async function machineState(env: NodeJS.ProcessEnv = process.env): Promise<MachineState> {
  const base = { cpu: os.cpus()[0]?.model ?? os.arch(), cores: os.cpus().length, platform: `${os.type()} ${os.release()} ${os.arch()}` };
  if (read(`${CPU}/online`) === "") return { available: false, ...base };
  const sut = cpuList(env["RB_SUT_CPUS"]);
  const gen = cpuList(env["RB_GEN_CPUS"]);
  const both = new Set([...sut, ...gen]);
  // acpi-cpufreq and amd_pstate say `boost`; intel_pstate says the negation as `no_turbo`.
  const boost = read(`${CPU}/cpufreq/boost`);
  const noTurbo = read(`${CPU}/intel_pstate/no_turbo`);
  const boostOn = boost !== "" ? boost === "1" : noTurbo !== "" ? noTurbo === "0" : null;
  const governors = [...new Set([...both].map((c) => read(`${CPU}/cpu${c}/cpufreq/scaling_governor`)).filter((g) => g !== ""))].sort();
  return {
    available: true,
    ...base,
    online: read(`${CPU}/online`),
    isolated: read(`${CPU}/isolated`),
    smt: read(`${CPU}/smt/control`, "notsupported"),
    smtActive: read(`${CPU}/smt/active`),
    driver: read(`${CPU}/cpu0/cpufreq/scaling_driver`),
    governors,
    boostOn,
    thp: read("/sys/kernel/mm/transparent_hugepage/enabled"),
    cmdline: read("/proc/cmdline"),
    sutCpus: show(sut),
    genCpus: show(gen),
    clock: both.size === 0 ? null : await clockSpread(both),
  };
}

/** What would make a published time describe the machine's configuration rather than the framework. */
export function problems(s: MachineState): string[] {
  if (!s.available) return ["not Linux: there is no CPU state to read, and nothing here is measurable"];
  const out: string[] = [];
  const sut = cpuList(s.sutCpus);
  const gen = cpuList(s.genCpus);
  const online = cpuList(s.online);
  const isolated = cpuList(s.isolated);
  if (sut.size === 0 || gen.size === 0) return ["RB_SUT_CPUS and RB_GEN_CPUS must both be set, or the framework and the generator share cores"];
  const overlap = [...sut].filter((c) => gen.has(c));
  if (overlap.length > 0) out.push(`the framework and the generator overlap on ${overlap.join(",")}`);
  const offline = [...sut, ...gen].filter((c) => !online.has(c));
  if (offline.length > 0) out.push(`cpu ${offline.join(",")} is not online`);
  if (s.smtActive === "1") out.push("SMT is on, so two cpu ids may be one physical core");
  if (s.boostOn === true) out.push("boost is on, so the clock moves with thermal headroom");
  if (s.governors.length > 0 && s.governors.join("/") !== "performance") out.push(`the governor is ${s.governors.join("/")}, not performance`);
  if (isolated.size === 0) out.push("no isolated cpus: nothing keeps other work off the measurement cores");
  else {
    const loose = [...sut, ...gen].filter((c) => !isolated.has(c));
    if (loose.length > 0) out.push(`cpu ${loose.join(",")} is not isolated`);
  }
  if (s.clock !== null && s.clock.spread > 0.02) out.push(`the clock moved ${(s.clock.spread * 100).toFixed(1)}% while idle`);
  return out;
}
