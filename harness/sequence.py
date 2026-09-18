"""Build spec/sequence.json: the fixed request order every serial host replays.

A function host runs one invocation at a time, so there is no knee to find and no reason
to sample a mix randomly. Every target replays the identical ordered list instead, which
removes mix variance entirely: the comparison becomes how long the same work took.

The draw is uniform, matching spec/endpoints.json. Endpoints are not weighted here, so the
sequence gives every one it draws the same number of invocations and every per-endpoint
percentile the same number of observations behind it.

Generated rather than committed by hand, and regenerated in CI to prove it has not drifted,
the same way spec/fixture.json and spec/plan.json are.
"""
import base64, json, pathlib, struct, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PLAN = json.loads((ROOT / "spec" / "plan.json").read_text())
LENGTH = 100_000
SEED = 0x5EED1234
# On a function platform, compression is expected from the host in front of the function,
# not from the framework. So no serial host is asked for the family, and harness/run.py has
# the gate skip it there too.
SKIPPED_FAMILIES = ["compressed"]


def xorshift32(seed):
    """Pinned and trivially portable, so any driver in any language can verify the order."""
    x = seed & 0xFFFFFFFF
    while True:
        x ^= (x << 13) & 0xFFFFFFFF
        x ^= x >> 17
        x ^= (x << 5) & 0xFFFFFFFF
        yield x


def build():
    eps = PLAN["endpoints"]
    assert PLAN["sampling"] == "uniform", PLAN["sampling"]
    # Indices stay into the plan's endpoint list, which is what every driver reads.
    drawn = [i for i, e in enumerate(eps) if e["family"] not in SKIPPED_FAMILIES]
    rnd = xorshift32(SEED)
    ep_idx, inst_idx = [], []
    for _ in range(LENGTH):
        ep_idx.append(drawn[next(rnd) % len(drawn)])
        inst_idx.append(next(rnd) % PLAN["instances"])
    return ep_idx, inst_idx


def main():
    ep_idx, inst_idx = build()
    eps = PLAN["endpoints"]
    counts = [0] * len(eps)
    for i in ep_idx:
        counts[i] += 1
    out = {
        "version": "sequence-v3",
        "length": LENGTH,
        "seed": SEED,
        "blend": PLAN["version"],
        "endpoints": [e["id"] for e in eps],
        "skipped_families": SKIPPED_FAMILIES,
        "endpoint_index": base64.b64encode(struct.pack("<%dH" % LENGTH, *ep_idx)).decode(),
        "instance_index": base64.b64encode(struct.pack("<%dH" % LENGTH, *inst_idx)).decode(),
    }
    p = ROOT / "spec" / "sequence.json"
    p.write_text(json.dumps(out, separators=(",", ":")))
    print("wrote %s  (%.0f KB, %s requests)" % (p, p.stat().st_size / 1024, f"{LENGTH:,}"))
    counts = [c for e, c in zip(eps, counts) if e["family"] not in SKIPPED_FAMILIES]
    lo, hi = min(counts), max(counts)
    exp = LENGTH / len(counts)
    print("  %s..%s invocations per endpoint against %s expected (spread %.2f%%)"
          % (f"{lo:,}", f"{hi:,}", f"{exp:,.0f}", 100 * (hi - lo) / exp))
    print("  the draw is uniform, so that spread is sampling noise and nothing else")
    return 0


if __name__ == "__main__":
    sys.exit(main())
