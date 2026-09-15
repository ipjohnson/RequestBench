"""What the measurement machine is, and whether it is set up to be measured on.

Absolute times are only reproducible while the machine holds still, so the things that
make it hold still are read from the machine rather than trusted to a runbook: SMT off,
a fixed clock, the target and the generator on disjoint isolated cores. The state is
recorded on every run and can gate a run that is meant to be published.

  python3 harness/machine.py                 # what this machine looks like now
  python3 harness/machine.py --check         # exit 1 if it is not ready to measure on
  python3 harness/machine.py --json          # the record that lands on the env row
"""
import argparse, json, os, pathlib, sys, time

CPU = pathlib.Path("/sys/devices/system/cpu")


def read(path, default=""):
    try:
        return pathlib.Path(path).read_text().strip()
    except OSError:
        return default


def cpu_list(spec):
    """Parse the kernel's "0-3,8" CPU list format into a set."""
    out = set()
    for part in (spec or "").split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            lo, _, hi = part.partition("-")
            out.update(range(int(lo), int(hi) + 1))
        else:
            out.add(int(part))
    return out


def show(cpus):
    return ",".join(str(c) for c in sorted(cpus))


def clock_spread(cpus, samples=10, gap=0.05):
    """How far the clock moved while we watched it.

    Governor and boost say what was configured. This says what the silicon did, which is
    the part that ends up in the numbers and the part that is commonly wrong.
    """
    seen = []
    for _ in range(samples):
        for c in sorted(cpus):
            khz = read(CPU / ("cpu%d/cpufreq/scaling_cur_freq" % c))
            if khz.isdigit():
                seen.append(int(khz))
        time.sleep(gap)
    if not seen:
        return {}
    lo, hi = min(seen), max(seen)
    return {"min_khz": lo, "max_khz": hi, "spread": round((hi - lo) / hi, 4) if hi else 0}


def state():
    """Every machine fact a published number depends on."""
    if not CPU.exists():
        return {"available": False}

    sut = cpu_list(os.environ.get("RB_SUT_CPUS", ""))
    gen = cpu_list(os.environ.get("RB_GEN_CPUS", ""))
    smt = read(CPU / "smt/control", "notsupported")
    # Two ways to say the same thing: acpi-cpufreq and amd_pstate expose `boost`, where
    # intel_pstate exposes the negation as `no_turbo`.
    boost, no_turbo = read(CPU / "cpufreq/boost"), read(CPU / "intel_pstate/no_turbo")
    if boost:
        boost_on = boost == "1"
    elif no_turbo:
        boost_on = no_turbo == "0"
    else:
        boost_on = None

    govs = sorted({read(CPU / ("cpu%d/cpufreq/scaling_governor" % c))
                   for c in (sut | gen)} - {""})
    return {
        "available": True,
        "online": read(CPU / "online"),
        "isolated": read(CPU / "isolated"),
        "smt": smt,
        "smt_active": read(CPU / "smt/active"),
        "driver": read(CPU / "cpu0/cpufreq/scaling_driver"),
        "governors": govs,
        "boost_on": boost_on,
        "thp": read("/sys/kernel/mm/transparent_hugepage/enabled"),
        "cmdline": read("/proc/cmdline"),
        "sut_cpus": show(sut),
        "gen_cpus": show(gen),
        "clock": clock_spread(sut | gen) if (sut | gen) else {},
    }


def problems(s):
    """What would make a published time mean something other than it says.

    Each entry is a reason not to publish, not a style note. A machine that trips any of
    these produces numbers that describe its configuration rather than the framework.
    """
    if not s.get("available"):
        return []                      # not Linux; local development, nothing to check
    out = []
    sut, gen = cpu_list(s["sut_cpus"]), cpu_list(s["gen_cpus"])
    online, isolated = cpu_list(s["online"]), cpu_list(s["isolated"])

    if not sut or not gen:
        out.append("RB_SUT_CPUS and RB_GEN_CPUS must both be set; "
                   "without them the target and the generator share cores")
        return out
    if sut & gen:
        out.append("sut and gen overlap on %s: the generator competes with the target"
                   % show(sut & gen))
    missing = (sut | gen) - online
    if missing:
        out.append("cpu %s is not online" % show(missing))
    if s["smt_active"] == "1":
        out.append("SMT is on, so a pair of cpu ids may be one physical core")
    if s["boost_on"]:
        out.append("boost is on, so the clock moves with thermal headroom and core count")
    if s["governors"] and s["governors"] != ["performance"]:
        out.append("governor is %s on the measurement cores, not performance"
                   % "/".join(s["governors"]))
    if isolated and not (sut | gen) <= isolated:
        out.append("cpu %s is not isolated, so other work can be scheduled onto it"
                   % show((sut | gen) - isolated))
    elif not isolated:
        out.append("no isolated cpus: nothing keeps other work off the measurement cores")
    spread = s.get("clock", {}).get("spread")
    if spread is not None and spread > 0.02:
        out.append("clock moved %.1f%% while idle, so it is not actually fixed"
                   % (spread * 100))
    return out


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true",
                    help="exit 1 if this machine is not ready to measure on")
    ap.add_argument("--json", action="store_true", help="the record, as the run stores it")
    a = ap.parse_args(argv[1:])

    s = state()
    if a.json:
        print(json.dumps(s, indent=2, sort_keys=True))
        return 0

    if not s.get("available"):
        print("not Linux: no cpu state to read, and nothing here is measurable")
        return 0

    for k in ("online", "isolated", "smt", "driver", "boost_on", "sut_cpus", "gen_cpus"):
        print("%-10s %s" % (k, s[k] if s[k] != "" else "—"))
    print("%-10s %s" % ("governor", "/".join(s["governors"]) or "—"))
    if s["clock"]:
        print("%-10s %d-%d kHz, %.2f%% spread"
              % ("clock", s["clock"]["min_khz"], s["clock"]["max_khz"],
                 s["clock"]["spread"] * 100))

    bad = problems(s)
    print()
    if not bad:
        print("ready to measure")
        return 0
    for b in bad:
        print("NOT READY: %s" % b)
    return 1 if a.check else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
