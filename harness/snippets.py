"""Where each endpoint is wired, per target, as a path and a line range.

  python3 harness/snippets.py node:fastify
  python3 harness/snippets.py --all --summary
  python3 harness/snippets.py node:fastify --at <commit>

A published ratio names a target and an endpoint. What a reader wants next is the handful
of lines that produced it, and nothing in the record points at them. This derives that
pointer rather than asking every target to declare one, because a declaration goes stale
silently and a derivation cannot: it is matched against the spec on every run.

Two ways in, in this order:

  derived   The endpoint's route is looked for as a string literal, tolerating whatever
            capture syntax the framework spells a parameter with and whatever it names it.
            gin writes /domain/orders/:oid where the spec writes /domain/orders/{order},
            and both have to land on the same line.

  marker    A comment naming one or more endpoint ids, for wiring no path can reach. Two
            cases, both real: a route registered from a loop over sizes, where the literal
            /compressed/small is never written down, and a handler with no route at all,
            like the framework's 404. A marker names several ids at once, so a baseline's
            segment switch takes about twenty of them rather than forty-five.

Nothing is stored. The site rebuilds a run's snippets from the commit that run recorded,
which is also the only way a page can be right about a run made months ago.

The two checks from docs/bundles.html §7, both of which have caught something:

  - a snippet must contain the path it claims to implement, which catches an expansion
    that walked off the end of the block it was supposed to capture
  - a route matching in more than one place is an error rather than a first match, because
    first-match is exactly how a comment or a test gets rendered as the implementation

Both of those ask where a snippet is. Neither asks what is in it, and `@Get("/json/small")`
passes both while showing a reader nothing. spec/marks.json holds the assertions that ask
the second question, and the allowance that says how much of the corpus fails them today.
They are counted rather than fatal, because they fail on most of the corpus and a red gate
would block the branches fixing it. --ratchet rewrites the allowance downward; --check
fails on anything above it.
"""
import argparse, functools, json, pathlib, re, sys

import bundle

ROOT = pathlib.Path(__file__).resolve().parent.parent
SPEC = ROOT / "spec"
ENDPOINTS = json.loads((SPEC / "endpoints.json").read_text())["endpoints"]
MARKS_PATH = SPEC / "marks.json"
MARKS = json.loads(MARKS_PATH.read_text())
BY_ID = {e["id"]: e for e in ENDPOINTS}

# How the frameworks in this repository spell a route parameter. The name is never
# matched, only the shape: the spec's {order} is gin's :oid and neither is authoritative.
# A converter is part of the shape rather than a name, which is why the colon is inside the
# brackets as well: Litestar writes {oid:str} and Django writes <int:pk>.
CAPTURE = r"(?::[\w]+|\{[\w.*:]*\}|<[\w:]+>|\*[\w]*)"

# A route literal is delimited, which is what keeps /domain/customers/{cid} from matching
# inside "/domain/customers/{cid}/summary".
QUOTE = "[\"'`]"

# A framework may spell its query parameters in the same literal as the path: Rocket writes
# #[get("/query/one?<q..>")] for what the spec writes as /query/one?page={page}. The route
# is still the part before the ?, so the tail is matched and ignored rather than being
# allowed to break the delimiter.
QUERY_SPEC = "(?:\\?[^\"'`]*)?"

METHODS = ("get", "post", "put", "patch", "delete")

MARKER = re.compile(r"rb:snippet\s+([\w.,\s]+?)\s*(?:\*/|$)")
# Wiring that spans two statements the dedent rule cannot join: a router group and the
# loop that registers into it are siblings, so the block has to be closed explicitly.
MARKER_END = re.compile(r"rb:snippet-end\b")

# Only the target's own wiring and its host entry points. The shared domain is in the
# bundle because changing it moves the target, but it holds behaviour rather than routing,
# and a route literal found there would be a coincidence.
SNIPPET_ROLES = ("source", "host")

OPEN, CLOSE = "([{", ")]}"


def route_of(ep):
    """The path a router would be given: no query string, no fragment."""
    return ep["path"].split("?", 1)[0]


@functools.lru_cache(maxsize=None)
def instance_regex(route):
    """The route as a matcher for concrete URLs, so a literal path can be recognised as an
    instance of a parameterised one. /domain/orders/999999 is one of /domain/orders/{order}
    and is therefore wired by it; /compressed/small is not one of /json/small and is not."""
    return re.compile("/".join(
        "[^/]+" if seg.startswith("{") and seg.endswith("}") else re.escape(seg)
        for seg in route.split("/")))


@functools.lru_cache(maxsize=None)
def route_regex(route):
    segments = []
    for seg in route.split("/")[1:]:
        if seg.startswith("{") and seg.endswith("}"):
            segments.append(CAPTURE)
        else:
            segments.append(re.escape(seg))
    # The leading slash is optional. Django's path() matches what is left after the slash
    # the request carried, so its patterns are written without one; everything else writes
    # it. The quotes still delimit, so this widens the shape a literal can take and not
    # where in a line it may sit.
    return re.compile(QUOTE + "/?" + "/".join(segments) + QUERY_SPEC + QUOTE)


def attribute(line, i):
    """Whether the # at `i` opens a Rust attribute rather than a comment.

    Python and YAML comment with #; Rust writes its routes on #[get("/x")]. Reading that
    as a comment blanked every attribute line, which hid every route in the rocket target
    and left the delimiter count for the lines around it wrong as well.
    """
    return i + 1 < len(line) and line[i + 1] in "[!"


def strip_code(line):
    """The line with string bodies and line comments blanked, for delimiter counting.

    Counting delimiters over raw source miscounts the moment a route contains a brace or a
    comment holds an unbalanced one, and both occur here.
    """
    out, i, quote = [], 0, None
    while i < len(line):
        c = line[i]
        if quote:
            if c == "\\":
                out.append("  ")
                i += 2
                continue
            out.append(" ")
            if c == quote:
                quote = None
            i += 1
            continue
        if c in "\"'`":
            quote = c
            out.append(" ")
            i += 1
            continue
        if line.startswith("//", i) or (line.startswith("#", i) and not attribute(line, i)):
            break
        out.append(c)
        i += 1
    return "".join(out)


def block_end(lines, start):
    """The last line of the delimited block opening on `start`.

    Forward to balanced delimiters, per docs/bundles.html §7. A registration that fits on
    one line closes on that line; one that carries a handler body closes wherever the body
    does. A line that opens nothing is its own block, which is what a bare annotation or a
    marker above a declaration needs.
    """
    depth, opened = 0, False
    for n in range(start, min(len(lines), start + 80)):
        for c in strip_code(lines[n]):
            if c in OPEN:
                depth += 1
                opened = True
            elif c in CLOSE:
                depth -= 1
        if opened and depth <= 0:
            return n
    return start


def indent_of(line):
    return len(line) - len(line.lstrip())


def opens_block(line):
    """Whether this line leaves a delimiter open. A route registration does; a switch case
    label does not, and the two need different end rules."""
    depth = 0
    for c in strip_code(line):
        depth += 1 if c in OPEN else -1 if c in CLOSE else 0
    return depth > 0


def marked_end(lines, start):
    """The last line of a block a marker labels.

    A marker sits above either a registration, which the balanced rule ends correctly, or a
    switch case, which opens nothing and therefore balances on its own first line. A case
    runs until the source dedents back to it, which is where the next case begins.
    """
    if opens_block(lines[start]):
        return block_end(lines, start)
    base, end = indent_of(lines[start]), start
    for n in range(start + 1, len(lines)):
        if lines[n].strip() and indent_of(lines[n]) <= base:
            break
        end = n
    while end > start and not lines[end].strip():
        end -= 1
    return end


def enclosing(lines, start):
    """The chain of open blocks this line sits inside, outermost first.

    A marker above a registration captures a handler. A marker deeper inside a nested
    registration captures a fragment: the lines that serve the endpoint, without the
    lines that say which endpoint. Those enclosing lines are not part of the snippet --
    the range has to stay the lines the endpoint is served by, because that is what the
    permalink points at -- so they travel beside it as context.

    Scanned forwards with a stack rather than backwards by indentation, because a line
    like `} else if (cond) {` closes one block and opens another, nets zero delimiters,
    and an indentation walk steps straight over it into the sibling branch. That put an
    endpoint under the arm that could not serve it.

    Every target now registers routes with the path written down, so this fires only for
    a group or a loop, where the enclosing frame is the function and adds little. It is
    kept for the next language in, where the shape is not guaranteed.
    """
    stack = []
    for n in range(start):
        for c in strip_code(lines[n]):
            if c in OPEN:
                stack.append(n)
            elif c in CLOSE and stack:
                stack.pop()
    out, seen = [], set()
    for n in stack:
        # One line can open two frames, `app.register(async (scope) => {` being both the
        # call and the arrow body. It is one line of context either way.
        if n not in seen and lines[n].strip():
            seen.add(n)
            out.append({"line": n + 1, "text": lines[n].rstrip()})
    return out


def annotated_start(lines, line):
    """Walk back over annotations sitting above a declaration.

    Java writes the route on an annotation and the handler underneath it; the snippet is
    both or it is neither.
    """
    n = line
    while n > 0:
        prev = lines[n - 1].strip()
        if prev.startswith("@") and not prev.startswith("@@"):
            n -= 1
        else:
            break
    return n


def method_on(lines, line):
    """The HTTP method a route registration on this line names, if it names one.

    Read from the line itself rather than from the framework's API shape, so `app.post(`,
    `r.POST(`, `.delete(` and `@GetMapping` all answer the same way. Without it
    /domain/orders matches its GET and its POST and the endpoint gets the wrong one.
    """
    text = strip_code(lines[line])
    head = text.split("(", 1)[0]
    for m in METHODS:
        if re.search(r"(?:^|[^A-Za-z])%s(?:$|[^A-Za-z])" % m, head, re.I):
            return m
        # A camelCase hump is a boundary too. Everything else writes the method with a
        # separator in front of it -- r.GET(, app.get(, @GetMapping -- but .NET runs it
        # together: MapGet, MapPost, WolverineDelete. Without this both registrations on
        # /domain/orders look identical and neither can be attributed.
        if re.search(r"[a-z]%s(?:$|[^a-z])" % m.capitalize(), head):
            return m
        if re.search(r"@%sMapping" % m, lines[line], re.I):
            return m
    # actix writes the method after the path -- .route("/x", web::get().to(h)) -- so it is
    # past the first paren and the head never sees it. Outside the literals, because a
    # path can contain a method name and must not be read as one.
    #
    # Only when the line names exactly one. axum registers two on a line --
    # get(lookup).put(replace) -- and answering "get" there hides the PUT endpoint, which
    # is worse than the no-opinion the caller already handles.
    outside = re.sub(r"%s[^\"\'`]*%s" % (QUOTE, QUOTE), "", text)
    seen = [m for m in METHODS
            if re.search(r"(?:^|[^A-Za-z])%s\s*\(" % m, outside, re.I)]
    return seen[0] if len(seen) == 1 else None


def text_of(lines, start, end):
    return "\n".join(lines[start:end + 1])


def comment_at(line):
    """Where a line comment starts, or the length of the line. Quote-aware, so a `//`
    inside a route literal does not truncate it."""
    i, quote = 0, None
    while i < len(line):
        c = line[i]
        if quote:
            i += 2 if c == "\\" else 1
            if c == quote:
                quote = None
            continue
        if c in "\"'`":
            quote = c
        elif line.startswith("//", i):
            return i
        elif line.startswith("#", i):
            if attribute(line, i):
                i += 1
                continue
            return i
        i += 1
    return len(line)


def derive(lines, ep):
    """Every place this endpoint's route is registered, as (start, end) line indexes."""
    rx = route_regex(route_of(ep))
    method = ep["method"].lower()
    hits = []
    for n, line in enumerate(lines):
        m = rx.search(line)
        # A route literal also appears in the prose above a neighbouring route. Counting
        # that would make a correct file ambiguous and fail the whole target.
        if not m or m.start() >= comment_at(line):
            continue
        found = method_on(lines, n)
        if found and found != method:
            continue
        start = annotated_start(lines, n)
        hits.append((start, block_end(lines, n)))
    return hits


def markers(lines):
    """Every rb:snippet marker in the file, as {endpoint id: (start, end)}."""
    out = {}
    for n, line in enumerate(lines):
        m = MARKER.search(line)
        if not m:
            continue
        # The marker labels the block under it, so the range starts on the next line.
        start = n + 1
        while start < len(lines) and (not lines[start].strip() or MARKER.search(lines[start])):
            start += 1
        if start >= len(lines):
            continue
        end = marked_end(lines, start)
        closed = next((k for k in range(start, len(lines)) if MARKER_END.search(lines[k])), None)
        opened = next((k for k in range(start, len(lines)) if MARKER.search(lines[k])), None)
        if closed is not None and (opened is None or closed < opened):
            end = max(end, closed - 1)
        for eid in re.split(r"[,\s]+", m.group(1).strip()):
            if eid:
                out[eid] = (start, end)
    return out


@functools.lru_cache(maxsize=None)
def sources(language, target, at=None):
    """The bundle files a route could be wired in, as path -> lines."""
    out = {}
    for entry in bundle.manifest(language, target, at)["files"]:
        if entry["role"] not in SNIPPET_ROLES:
            continue
        try:
            text = bundle.blob(entry["path"], at).decode("utf-8")
        except UnicodeDecodeError:
            continue
        out[entry["path"]] = (text.splitlines(), entry["hash"])
    return out


# ---- assertions -------------------------------------------------------------------
#
# Locating a snippet is not the same as capturing one. `@Get("/json/small")` contains the
# path it claims, matches in exactly one place, and passes both of the checks above while
# saying nothing about what answers the request. These ask the other question.

# An annotation, an attribute, or a comment. None of them is a handler.
ANNOTATION = re.compile(r"^\s*(?:@|#\[|\[[A-Za-z])")
COMMENT = re.compile(r"^\s*(?://|/\*|\*|#(?!\[))")

# What a file that uses the shared domain imports, per language. The directory the bundle
# lists is not enough: Rust publishes it as the crate rb_domain, Java as the package
# rb.domain and .NET as the namespace RequestBench.Domain, and none of those is spelled
# like the directory. Reading the import rather than matching the domain's own symbol
# names is what keeps echo's local `payload` helper from counting as the domain's
# `Payload`.
DOMAIN_IMPORT = {
    "node": (r"import\s+\*\s+as\s+(\w+)\s+from\s+[\"'][^\"']*_shared/",
             r"import\s+\{([^}]+)\}\s+from\s+[\"'][^\"']*_shared/"),
    "python": (r"from\s+_shared(?:\.\w+)?\s+import\s+([^\n]+)",),
    "go": (r"(?:(\w+)\s+)?\"[^\"]*/go/_shared\"",),
    "rust": (r"use\s+rb_domain(?:::(?:\{([^}]*)\}|(\w+)))?(?:\s+as\s+(\w+))?\s*;",),
    "java": (r"import\s+(?:static\s+)?rb\.domain\.([\w.]+)\s*;",),
    # C# imports a namespace rather than a name, so the names are the domain's own. The
    # handler writes `(DomainModel d) => d.Payload("small")` and nothing in it says where
    # DomainModel came from.
    "dotnet": (r"using\s+RequestBench\.Domain\s*;",),
}

PUBLIC_DECL = (re.compile(r"public\s+(?:static\s+|sealed\s+|partial\s+|abstract\s+|"
                          r"readonly\s+|final\s+)*(?:class|record|struct|interface|enum)"
                          r"\s+(\w+)"),
               re.compile(r"public\s+static\s+[\w.<>\[\],?\s]+?\s(\w+)\s*\("))


def shared_symbols(language, target, at=None):
    """The public names the shared domain declares, for the language that needs them."""
    out = set()
    if language != "dotnet":
        return out
    for entry in bundle.manifest(language, target, at)["files"]:
        if entry["role"] != "shared" or not entry["path"].endswith(".cs"):
            continue
        try:
            text = bundle.blob(entry["path"], at).decode("utf-8")
        except UnicodeDecodeError:
            continue
        for rx in PUBLIC_DECL:
            out.update(rx.findall(text))
    return out


def domain_names(language, text, symbols):
    """The names this file uses for the shared domain.

    A snippet reaches the domain when it names one of them. Which is the question the
    coverage gate never asked: a registration that names a handler defined elsewhere in
    the file is complete, correct, and shows a reader nothing.
    """
    names = set()
    for pattern in DOMAIN_IMPORT.get(language, ()):
        for m in re.finditer(pattern, text):
            groups = [g for g in m.groups() if g]
            if not groups and language == "dotnet":
                names.update(symbols)
            elif not groups and language == "go":
                names.add("domain")
            for g in groups:
                for part in re.split(r"[,{}]", g):
                    part = part.strip()
                    if part:
                        # `domain as d` and `rb.domain.Model.PayloadBody` both end on the
                        # name the file actually writes.
                        names.add(re.split(r"\s+as\s+|\.", part)[-1].strip())
    return {n for n in names if re.fullmatch(r"\w+", n)}


def only_annotations(text):
    """Whether a snippet is nothing but annotations, attributes and comments.

    403 snippets ship in this shape today, most of a target at a time: micronaut 45/45,
    rocket 45/45, quarkus 44/45. Each one names its route and stops above the declaration
    that answers it.
    """
    for line in text.splitlines():
        s = line.strip()
        if s and not COMMENT.match(s) and not ANNOTATION.match(s):
            return False
    return True


def reaches_domain(text, names):
    """Whether the snippet names something the shared domain gave this file."""
    return any(re.search(r"\b%s\b" % re.escape(n), text) for n in names)


def assess(language, target, found, at=None):
    """Which endpoints fail each assertion, as {assertion: [endpoint id, ...]}.

    Counted rather than fatal. The three failures this is measuring are most of the
    corpus, so a gate that went red on them would block every branch that is fixing them;
    spec/marks.json carries what is allowed and it only ever goes down.
    """
    symbols = shared_symbols(language, target, at)
    files = sources(language, target, at)
    out = {name: [] for name in MARKS["assertions"]}
    for eid, rec in sorted(found.items()):
        parts = [rec["handler"], *rec["support"]] if "handler" in rec else [rec]
        text = "\n".join(p["text"] for p in parts)
        names = set()
        for p in parts:
            names |= domain_names(language, "\n".join(files[p["path"]][0]), symbols)
        for name, spec in MARKS["assertions"].items():
            if eid in spec.get("except", ()):
                continue
            failed = (only_annotations(text) if name == "not_only_annotations"
                      else not reaches_domain(text, names))
            if failed:
                out[name].append(eid)
    return out


def allowed(language, target):
    return MARKS["allowance"].get("%s:%s" % (language, target), {})


def resolve(language, target, at=None):
    """One record per endpoint this target wires, plus one complaint per problem.

    A record is the path, the one-based inclusive line range, and the hash of the file it
    came from. The hash is what lets the site refuse to link when history no longer holds
    the bytes that were measured.
    """
    files = sources(language, target, at)
    marked = {path: markers(lines) for path, (lines, _) in files.items()}
    out, problems = {}, []

    for ep in ENDPOINTS:
        eid = ep["id"]
        hits, via = [], route_of(ep)
        for path, (lines, fhash) in files.items():
            if eid in marked[path]:
                start, end = marked[path][eid]
                hits.append(("marker", path, fhash, lines, start, end))
        if not hits:
            for path, (lines, fhash) in files.items():
                for start, end in derive(lines, ep):
                    hits.append(("derived", path, fhash, lines, start, end))
        # An endpoint with no route of its own is served by the parameterised route it is
        # an instance of: errors.not_found asks for /domain/orders/999999, which nothing
        # registers, and domain.lookup's /domain/orders/{order} is what answers it. Only an
        # instance qualifies. `base` is otherwise a comparison, not an alias, and following
        # it blindly pointed compressed.small at the /json/small line it is measured against.
        if not hits and ep.get("base") in BY_ID:
            base_route = route_of(BY_ID[ep["base"]])
            if base_route != via and instance_regex(base_route).fullmatch(via):
                via = base_route
                for path, (lines, fhash) in files.items():
                    for start, end in derive(lines, BY_ID[ep["base"]]):
                        hits.append(("derived", path, fhash, lines, start, end))

        if not hits:
            continue
        spans = {(h[1], h[4], h[5]) for h in hits}
        if len(spans) > 1:
            where = ", ".join("%s:%d" % (p, s + 1) for p, s, _ in sorted(spans))
            problems.append("%s:%s %s matches in %d places: %s"
                            % (language, target, eid, len(spans), where))
            continue
        how, path, fhash, lines, start, end = hits[0]
        body = text_of(lines, start, end)
        names_route = bool(route_regex(via).search(body))
        if how == "derived" and not names_route:
            problems.append("%s:%s %s expanded past its own route (%s:%d-%d)"
                            % (language, target, eid, path, start + 1, end + 1))
            continue
        # A snippet that writes its own route identifies itself and needs nothing more. One
        # that does not is a fragment of a dispatch, and the blocks it is nested in are what
        # make it a handler rather than a condition. See enclosing().
        # Nothing to report when this comes back empty: a block registering routes from a
        # loop sits at the top level and is self-contained, which is the other thing a
        # marker is for.
        context = [] if names_route else enclosing(lines, start)
        out[eid] = {"endpoint": eid, "target": "%s:%s" % (language, target),
                    "path": path, "start_line": start + 1, "end_line": end + 1,
                    "hash": fhash, "how": how, "text": body, "context": context}
    return out, problems


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("targets", nargs="*", metavar="language:target")
    ap.add_argument("--all", action="store_true", help="every implemented target")
    ap.add_argument("--at", default=None, metavar="COMMIT",
                    help="resolve against history instead of the working tree")
    ap.add_argument("--summary", action="store_true", help="one line per target")
    ap.add_argument("--required", action="store_true",
                    help="every implemented target, which all have to locate every endpoint")
    ap.add_argument("--ratchet", action="store_true",
                    help="rewrite the allowance in spec/marks.json from what the tree does")
    ap.add_argument("--check", action="store_true",
                    help="exit non-zero if a required target is short an endpoint, or any "
                         "target reports a problem")
    a = ap.parse_args()

    required = list(bundle.implemented())
    pairs = list(bundle.implemented()) if a.all else []
    if a.required:
        pairs += required
    for entry in a.targets:
        language, _, name = entry.partition(":")
        if not name:
            sys.exit("target %r has no language: write language:target" % entry)
        pairs.append((language, name))
    if not pairs:
        sys.exit("no targets: name some, or pass --all")

    total_bad, measured = 0, {}
    for language, name in pairs:
        found, problems = resolve(language, name, a.at)
        # Every implemented target has to locate every endpoint it serves.
        if (language, name) in required and len(found) < len(ENDPOINTS):
            problems.append("%s:%s is conformance-required but locates only %d/%d endpoints"
                            % (language, name, len(found), len(ENDPOINTS)))
        failed = assess(language, name, found, a.at)
        counts = {k: len(v) for k, v in failed.items() if v}
        cap = allowed(language, name)
        if counts:
            measured["%s:%s" % (language, name)] = counts
        for k in sorted(set(counts) | set(cap)):
            n, was = counts.get(k, 0), cap.get(k, 0)
            if n > was:
                problems.append("%s:%s fails %s on %d endpoints, %d allowed: %s"
                                % (language, name, k, n, was,
                                   ", ".join(failed[k][:4]) + (", …" if n > 4 else "")))
        total_bad += len(problems)
        derived = sum(1 for r in found.values() if r["how"] == "derived")
        if a.summary or a.check or a.ratchet:
            print("%-22s %2d/%d endpoints  (%d derived, %d marked)%s%s"
                  % ("%s:%s" % (language, name), len(found), len(ENDPOINTS),
                     derived, len(found) - derived,
                     "".join("  %d %s" % (counts[k], MARKS["assertions"][k]["label"])
                             for k in sorted(counts)),
                     "  %d PROBLEM(S)" % len(problems) if problems else ""))
        else:
            print(json.dumps([{k: v for k, v in r.items() if k != "text"}
                              for r in found.values()], indent=2))
        for line in problems:
            print("  %s" % line)
        for k in sorted(cap):
            if counts.get(k, 0) < cap[k]:
                print("  %s is down to %d from an allowance of %d: run --ratchet"
                      % (k, counts.get(k, 0), cap[k]))

    if a.ratchet:
        if set(pairs) != set(required):
            sys.exit("--ratchet rewrites the whole allowance, so it needs every "
                     "target: pass --all")
        doc = json.loads(MARKS_PATH.read_text())
        doc["allowance"] = {k: dict(sorted(v.items())) for k, v in sorted(measured.items())}
        MARKS_PATH.write_text(json.dumps(doc, indent=2) + "\n")
        print("wrote %s: %d target(s) still failing something"
              % (MARKS_PATH.relative_to(ROOT), len(measured)))
        return 0
    return 1 if (a.check and total_bad) else 0


if __name__ == "__main__":
    sys.exit(main() or 0)
