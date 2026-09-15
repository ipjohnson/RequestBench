"""Target bundles: the files that decide how one target behaves, and their hashes.

  python3 harness/bundle.py node:fastify
  python3 harness/bundle.py --all

A run records framework, version, runtime, adapter and serializer. That is everything
about the dependency and nothing about the code that calls it, so when a ratio steps
between two nights the record cannot say whether the wiring changed. A bundle is the
missing half: the target's own wiring, the shared domain module every target in the
language calls, the dependency manifests the version was resolved from, and the
Dockerfiles that pin the runtime. Any of them moves the target, so all of them are hashed.

Two rollups. code_hash covers everything except prose, so correcting a README does not
read as a target that changed. bundle_hash covers prose as well, so a corrected README
does produce a new page. Keeping both is free once files are listed individually, and
conflating them would make one of the two behaviours wrong.

The rules are versioned as bundle-v1, because changing any of them silently reissues
every hash in the series:

  - the file set comes from git ls-files, never a filesystem walk, so an editor backup or
    a stale build artifact cannot enter it
  - paths are repo-relative with forward slashes, sorted bytewise
  - each file is SHA-256 over its raw bytes on disk, full hex digest
  - .gitattributes pins * text=auto eol=lf, without which a Windows checkout changes
    every hash
  - the rollup is SHA-256 over the canonical manifest text, not over a JSON serialisation

Bytes come from the working tree rather than from the commit, because the hash has to
describe what actually ran. That makes a dirty tree detectable: the recorded hash will
not verify against `git show <commit>:<path>`, and docs/bundles.html §4 has the site say
the source is unavailable rather than render today's file under an old number.

Still to build: the framework metadata block in docs/bundles.html §5, which derives repo,
licence and homepage from the resolved dependency tree. It needs no run to produce it, so
unlike the hashes it can be added to the series at any time.
"""
import argparse, functools, hashlib, json, os, pathlib, re, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SPEC = ROOT / "spec"
MATRIX = json.loads((SPEC / "matrix.json").read_text())

BUNDLE_VERSION = "bundle-v1"


# The two directories every target in a language shares: the domain module they all call,
# and the host entry points that invoke them. Java spells both without the underscore.
SHARED_DIR = {"java": "shared"}
HOST_DIR = {"java": "hosts"}

MANIFEST_NAMES = {"package.json", "package-lock.json", "go.mod", "go.sum", "pom.xml",
                  "Cargo.toml", "Cargo.lock"}
CONFIG_SUFFIXES = (".properties", ".yaml", ".yml", ".toml", ".ini", ".conf")

# Host entry points that sit inside a target's own directory rather than in the shared
# host module: Go names the file, Java gives it a package.
HOST_IN_TARGET = re.compile(r"/rb/(lambda|gcp)/|/lambda\.go$")

# A bundle missing any of these did not resolve. See check().
REQUIRED_ROLES = ("source", "shared", "manifest")


def target_dir(name):
    """A target's directory is its name. Nothing is special-cased any more."""
    return name


def shared_dir(language):
    return SHARED_DIR.get(language, "_shared")


def host_dir(language):
    return HOST_DIR.get(language, "_hosts")


def git(*args):
    out = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True)
    if out.returncode != 0:
        raise RuntimeError("git %s: %s" % (" ".join(args), out.stderr.strip()))
    return out.stdout


def git_bytes(*args):
    """File contents are hashed, so they have to arrive as bytes and never through a
    decode. A source file is not always valid UTF-8 and a round trip would not be identity
    even when it is."""
    out = subprocess.run(["git", *args], cwd=ROOT, capture_output=True)
    if out.returncode != 0:
        raise RuntimeError("git %s: %s" % (" ".join(args), out.stderr.decode().strip()))
    return out.stdout


# Every lookup below takes `at`: None reads the working tree, a commit reads history.
# A run records the commit it measured, so the site rebuilds that run's manifest from
# history rather than from today's files, which is the whole point of recording it.
@functools.lru_cache(maxsize=None)
def tracked(prefix, at=None):
    if at is None:
        return tuple(p for p in git("ls-files", "-z", "--", prefix).split("\0") if p)
    return tuple(p for p in git("ls-tree", "-r", "-z", "--name-only", at, "--", prefix)
                 .split("\0") if p)


@functools.lru_cache(maxsize=None)
def matrix_at(at):
    """bundle_roots as it stood at that commit. Reading today's would misresolve a target
    whose roots were declared later, and the rollup would then fail to verify against a
    perfectly good run."""
    return MATRIX if at is None else json.loads(git("show", "%s:spec/matrix.json" % at))


def blob(path, at=None):
    if at is None:
        return (ROOT / path).read_bytes()
    return git_bytes("cat-file", "blob", "%s:%s" % (at, path))


def roots(language, target, at=None):
    """The paths a target's file set is drawn from.

    A path ending in / contributes only the files sitting directly in it. Any other path
    contributes its whole subtree.

    A target the convention does not fit declares its own list under bundle_roots in
    spec/matrix.json, keyed language:target, the way the host exclusions are declared.
    """
    declared = matrix_at(at).get("bundle_roots", {}).get("%s:%s" % (language, target))
    if declared:
        return list(declared)
    lang = "targets/" + language
    return ["%s/%s" % (lang, target_dir(target)),
            "%s/%s" % (lang, shared_dir(language)),
            "%s/%s" % (lang, host_dir(language)),
            lang + "/"]


def files(language, target, at=None):
    """Every tracked file in the bundle, sorted.

    The language directory contributes only the manifests and Dockerfiles sitting directly
    in it. Listing it whole would sweep in every sibling target.
    """
    wanted = set()
    for root in roots(language, target, at):
        if root.endswith("/"):
            wanted.update(p for p in tracked(root.rstrip("/"), at)
                          if "/" not in p[len(root):])
        else:
            wanted.update(tracked(root, at))
    if not wanted:
        raise RuntimeError("%s:%s has no tracked files under %s"
                           % (language, target, ", ".join(roots(language, target, at))))
    # The rule is bytewise, which for UTF-8 is what sorting the strings already does:
    # byte order and code point order agree. Only something locale-aware would differ,
    # and that would differ between machines.
    return sorted(wanted)


def role(language, path):
    name = path.rsplit("/", 1)[-1]
    if name.endswith(".md"):
        return "prose"
    if name in MANIFEST_NAMES:
        return "manifest"
    if name.endswith(CONFIG_SUFFIXES):
        return "config"
    if (name.startswith("Dockerfile") or "/%s/" % host_dir(language) in path
            or HOST_IN_TARGET.search(path)):
        return "host"
    if "/%s/" % shared_dir(language) in path:
        return "shared"
    return "source"


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for block in iter(lambda: fh.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def rollup(entries):
    """SHA-256 over one '<hash>  <path>' line per file, in sorted order.

    Hashing a JSON serialisation would make the digest depend on key order, spacing and
    how a language's encoder escapes; a line-oriented form has one representation. It is
    sha256sum's own format, so the canonical text verifies with `sha256sum -c` from the
    repository root.
    """
    text = "".join("%s  %s\n" % (e["hash"][7:], e["path"]) for e in entries)
    return "sha256:" + hashlib.sha256(text.encode()).hexdigest()


def commit():
    return git("rev-parse", "HEAD").strip()


def repo():
    """The owner/name slug. Recorded rather than hard-coded so a fork's pages link to the
    fork's own code."""
    slug = os.environ.get("GITHUB_REPOSITORY", "")
    if slug:
        return slug
    m = re.search(r"[:/]([^/:]+/[^/]+?)(?:\.git)?$", git("remote", "get-url", "origin").strip())
    return m.group(1) if m else ""


@functools.lru_cache(maxsize=None)
def pushed(at):
    """Whether a remote-tracking branch holds this commit.

    A permalink to a commit that was never pushed is a 404, which reads as the code having
    been deleted rather than as the run having been local. Nightly runs are Actions runs on
    a pushed commit, so this only ever hides a link for a local run.
    """
    try:
        return bool(git("branch", "-r", "--contains", at).strip())
    except RuntimeError:
        return False


def manifest(language, target, at=None):
    entries = []
    for path in files(language, target, at):
        raw = blob(path, at)
        entries.append({"path": path, "role": role(language, path),
                        "bytes": len(raw),
                        "hash": "sha256:" + hashlib.sha256(raw).hexdigest()})
    return {"bundle_version": BUNDLE_VERSION, "target": "%s:%s" % (language, target),
            "bundle_hash": rollup(entries),
            "code_hash": rollup([e for e in entries if e["role"] != "prose"]),
            "commit": at or commit(), "files": entries}


def hashes(language, target):
    """Just the two rollups, which is all a run record carries."""
    m = manifest(language, target)
    return {"bundle_hash": m["bundle_hash"], "code_hash": m["code_hash"]}


def check(pairs):
    """Return one complaint per target whose bundle did not resolve.

    A target with no wiring of its own, no shared domain or no dependency manifest is the
    convention in roots() failing to fit a language and producing a partial file set. A
    partial set hashes as cleanly as a complete one, so nothing else would notice.
    """
    bad = []
    for language, name in pairs:
        try:
            roles = {e["role"] for e in manifest(language, name)["files"]}
        except Exception as e:
            bad.append("%s:%s did not resolve (%s)" % (language, name, e))
            continue
        missing = [r for r in REQUIRED_ROLES if r not in roles]
        if missing:
            bad.append("%s:%s has no %s file" % (language, name, " and no ".join(missing)))
    return bad


def implemented():
    for language, spec in MATRIX["languages"].items():
        for name in spec["implemented"]:
            yield language, name


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("targets", nargs="*", metavar="language:target")
    ap.add_argument("--all", action="store_true", help="every implemented target")
    ap.add_argument("--summary", action="store_true",
                    help="one line per target instead of the full manifest")
    ap.add_argument("--check", action="store_true",
                    help="assert every named bundle resolved; print nothing else")
    a = ap.parse_args()

    pairs = list(implemented()) if a.all else []
    for entry in a.targets:
        language, _, name = entry.partition(":")
        if not name:
            sys.exit("target %r has no language: write language:target" % entry)
        if language not in MATRIX["languages"]:
            sys.exit("unknown language %r in target %r" % (language, entry))
        pairs.append((language, name))
    if not pairs:
        sys.exit("no targets: name some, or pass --all")

    if a.check:
        bad = check(pairs)
        for line in bad:
            print(line)
        print("%d/%d bundles resolve" % (len(pairs) - len(bad), len(pairs)))
        return 1 if bad else 0

    for language, name in pairs:
        m = manifest(language, name)
        if a.summary:
            print("%-22s code %s  bundle %s  %2d files"
                  % (m["target"], m["code_hash"][7:19], m["bundle_hash"][7:19],
                     len(m["files"])))
        else:
            print(json.dumps(m, indent=2))


if __name__ == "__main__":
    sys.exit(main() or 0)
