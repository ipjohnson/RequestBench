"""Build spec/sequence.json: the fixed request order every serial host replays.

A function host runs one invocation at a time, so there is no knee to find and no reason
to sample a mix randomly. Every target replays the identical ordered list instead, which
removes mix variance entirely: the comparison becomes how long the same work took.

The draw is uniform, matching spec/endpoints.json. Endpoints are not weighted here, so the
sequence gives every one of them the same number of invocations and every per-endpoint
percentile the same number of observations behind it.

Generated rather than committed by hand, and regenerated in CI to prove it has not drifted,
the same way spec/fixture.json and spec/plan.json are.
"""
import base64, json, pathlib, struct, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PLAN = json.loads((ROOT / "spec" / "plan.json").read_text())
LENGTH = 100_000
SEED = 0x5EED1234


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
    rnd = xorshift32(SEED)
    ep_idx, inst_idx = [], []
    for _ in range(LENGTH):
        ep_idx.append(next(rnd) % len(eps))
        inst_idx.append(next(rnd) % PLAN["instances"])
    return ep_idx, inst_idx


def main():
    ep_idx, inst_idx = build()
    eps = PLAN["endpoints"]
    counts = [0] * len(eps)
    for i in ep_idx:
        counts[i] += 1
    out = {
        "version": "sequence-v2",
        "length": LENGTH,
        "seed": SEED,
        "blend": PLAN["version"],
        "endpoints": [e["id"] for e in eps],
        "endpoint_index": base64.b64encode(struct.pack("<%dH" % LENGTH, *ep_idx)).decode(),
        "instance_index": base64.b64encode(struct.pack("<%dH" % LENGTH, *inst_idx)).decode(),
    }
    p = ROOT / "spec" / "sequence.json"
    p.write_text(json.dumps(out, separators=(",", ":")))
    print("wrote %s  (%.0f KB, %s requests)" % (p, p.stat().st_size / 1024, f"{LENGTH:,}"))
    lo, hi = min(counts), max(counts)
    exp = LENGTH / len(eps)
    print("  %s..%s invocations per endpoint against %s expected (spread %.2f%%)"
          % (f"{lo:,}", f"{hi:,}", f"{exp:,.0f}", 100 * (hi - lo) / exp))
    print("  the draw is uniform, so that spread is sampling noise and nothing else")
    return 0


if __name__ == "__main__":
    sys.exit(main())
