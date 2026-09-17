"""What the site needs out of git history, for every target in one run.

The framework pages describe a target as one run measured it, which means reading the bundle
and locating the handlers at the commit that run recorded rather than in the working tree.
bundle.py and snippets.py already do that, and snippets.py is the only authority on where a
handler starts and ends: `make snippets` and the gate in validate.yml read the same function.
A second implementation in TypeScript would be a second answer to that question, which is the
one thing worth not having.

So this is the seam. It composes the two and prints one JSON document, and the site renders
it. One process for a whole run, because every target re-reads the same history.

  python3 harness/siteview.py --at <commit> go:chi node:fastify
  python3 harness/siteview.py --at <commit> --all
"""
import argparse, json, sys

import bundle, snippets


def view(language, target, at):
    """The target's manifest, snippets and README at `at`, or None when history cannot answer.

    None is a shallow checkout, a rewritten branch, or a rollup that does not match what the
    run recorded. Rendering today's file under an old number is the failure this whole
    mechanism exists to prevent, so nothing is guessed.
    """
    try:
        man = bundle.manifest(language, target, at=at)
        snips, problems = snippets.resolve(language, target, at=at)
    except Exception:
        return None
    # The target's own README, not any prose the bundle happens to sweep in. The shared host
    # note is in every Node bundle, and matching it put a page about the host contract under
    # every framework's name.
    want = "targets/%s/%s/README.md" % (language, bundle.target_dir(target))
    readme = ""
    if any(e["path"] == want for e in man["files"]):
        try:
            readme = bundle.blob(want, at).decode("utf-8")
        except Exception:
            readme = ""
    return {"manifest": man, "snippets": snips, "problems": problems,
            "pushed": bundle.pushed(at), "readme": readme}


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("targets", nargs="*", metavar="language:target")
    ap.add_argument("--all", action="store_true", help="every implemented target")
    ap.add_argument("--at", default=None, metavar="COMMIT",
                    help="resolve against history instead of the working tree")
    a = ap.parse_args()

    pairs = list(bundle.implemented()) if a.all else []
    for entry in a.targets:
        language, _, name = entry.partition(":")
        if not name:
            sys.exit("target %r has no language: write language:target" % entry)
        pairs.append((language, name))
    if not pairs:
        sys.exit("no targets: name some, or pass --all")

    # Resolve to a SHA here rather than passing a name down: the manifest records the commit
    # it was read at, and "HEAD" recorded in a page says nothing a month later.
    try:
        at = bundle.git("rev-parse", a.at or "HEAD").strip()
    except RuntimeError:
        at = a.at or ""

    out = {}
    for language, name in pairs:
        out["%s:%s" % (language, name)] = view(language, name, at)
    json.dump({"commit": at, "repo": bundle.repo(), "targets": out},
              sys.stdout, separators=(",", ":"))
    return 0


if __name__ == "__main__":
    sys.exit(main() or 0)
