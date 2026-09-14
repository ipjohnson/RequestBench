"""Build spec/sequence.json: the fixed request order every serial host replays.

A function host runs one invocation at a time, so there is no knee to find and no reason
to sample a mix randomly. Every target replays the identical ordered list instead, which
removes mix variance entirely: the comparison becomes how long the same work took.

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
    total = sum(e["share"] for e in eps)
    # Cumulative shares, so a draw picks an endpoint in proportion to its blend weight.
    cum, acc = [], 0
    for e in eps:
        acc += e["share"]
        cum.append(acc)

    rnd = xorshift32(SEED)
    ep_idx, inst_idx = [], []
    for _ in range(LENGTH):
        r = next(rnd) % total
        lo, hi = 0, len(cum) - 1
        while lo < hi:
            mid = (lo + hi) // 2
            if r < cum[mid]:
                hi = mid
            else:
                lo = mid + 1
        ep_idx.append(lo)
        inst_idx.append(next(rnd) % PLAN["instances"])
    return ep_idx, inst_idx


def main():
    ep_idx, inst_idx = build()
    eps = PLAN["endpoints"]
    counts = [0] * len(eps)
    for i in ep_idx:
        counts[i] += 1
    out = {
        "version": "sequence-v1",
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
    lo = min(counts)
    worst = eps[counts.index(lo)]["id"]
    print("  rarest endpoint %s gets %s of %s requests (%.2f%%)"
          % (worst, f"{lo:,}", f"{LENGTH:,}", 100 * lo / LENGTH))
    exp = min(e["share"] for e in eps) / sum(e["share"] for e in eps)
    print("  expected share %.2f%%, so the draw tracks the blend weights" % (100 * exp))
    return 0


if __name__ == "__main__":
    sys.exit(main())
