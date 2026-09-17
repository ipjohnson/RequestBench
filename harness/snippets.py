"""Where each endpoint is wired, per target, as a path and a line range.

  python3 harness/snippets.py node:fastify
  python3 harness/snippets.py --all --summary
  python3 harness/snippets.py node:fastify --at <commit>

A published ratio names a target and an endpoint. What a reader wants next is the handful
of lines that produced it, and nothing in the record points at them. This derives that
pointer rather than asking every target to declare one, because a declaration goes stale
silently and a derivation cannot: it is matched against the spec on every run.

Two ways in, in this order:

  marked    A mark claims a range for one or more endpoints or families:

                rb:<kind> <selector>[,<selector>...]   closed by rb:end
                rb:handler json.small
                rb:wiring compressed.*

            A selector is family.endpoint for one, family.* for all of a family, or * for
            the target. The kinds are in spec/marks.json, which says what each selects,
            which file roles it may read and what has to be true of what it captured, so
            nothing here learns a kind's name.

  derived   With no mark, the endpoint's route is looked for as a string literal,
            tolerating whatever capture syntax the framework spells a parameter with and
            whatever it names it. gin writes /domain/orders/:oid where the spec writes
            /domain/orders/{order}, and both have to land on the same line. That is still
            how most of the corpus is located, and 1,485 hand-written marks would be 700
            to 900 comment lines in files whose whole job is to read as clean framework
            code. Derive where the route sits on the declaration and the assertions pass;
            mark where they do not.

Nothing is stored. The site rebuilds a run's snippets from the commit that run recorded,
which is also the only way a page can be right about a run made months ago.

The two checks from docs/bundles.html §7, both of which have caught something:

  - a snippet must contain the path it claims to implement, which catches an expansion
    that walked off the end of the block it was supposed to capture
  - a route matching in more than one place is an error rather than a first match, because
    first-match is exactly how a comment or a test gets rendered as the implementation

Both of those ask where a snippet is. Neither asks what is in it, and `@Get("/json/small")`
passes both while showing a reader nothing. The assertions in spec/marks.json ask the
second question, counted against an allowance that only ever goes down: --ratchet rewrites
it from what the tree does, --check fails on anything above it. It is empty today.

The other half of the claim is per family rather than per endpoint. spec/matrix.json
declares what each target wires each family with; a family that names a mechanism has to
produce the wiring it named, and the dependency it declares has to be in that target's
manifest and be mentioned by the parts claiming it. A family with nothing to show says so
in a sentence, because a page that renders a blank section reads as missing data.
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

# A mark opens a comment: `// rb:handler json.small`, `# rb:wiring compressed.*`. Anchored
# at the start of the comment so prose that mentions a mark is not read as one.
MARK = re.compile(r"^[\s/*#<!-]*rb:([a-z]+)\b[ \t]*(.*?)[ \t]*(?:\*/|-->)?[ \t]*$")
# Wiring that spans two statements the block rule cannot join: a router group and the loop
# that registers into it are siblings, so the extent has to be closed explicitly.
MARK_END = re.compile(r"^[\s/*#<!-]*rb:end\b")

# What each kind selects, what it may read, and what must be true of it. snippets.py never
# learns a kind's name: adding one is an object here and a display section. The key=value
# pairs the grammar allows after the selectors ride on the part; no kind reads one yet, and
# a wiring dependency is declared per target in spec/matrix.json rather than repeated on
# every mark that provides it.
KINDS = MARKS["kinds"]

# The families, in the order the spec lists them. A family is what wiring is keyed by: six
# compressed.* endpoints share one gzip and four cached.* share one validator.
FAMILIES = list(dict.fromkeys(e["family"] for e in ENDPOINTS))

OPEN, CLOSE = "([{", ")]}"

# An annotation, an attribute, or a comment. None of them is a handler.
ANNOTATION = re.compile(r"^\s*(?:@|#\[|\[[A-Za-z])")
COMMENT = re.compile(r"^\s*(?://|/\*|\*|#(?!\[))")

# Languages where ' is a character literal rather than a string delimiter. Rust spells a
# lifetime with the same tick, which is neither. See char_literal().
CHAR_QUOTE = ("go", "java", "dotnet", "rust")


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


def char_literal(line, i):
    """Whether the ' at `i` opens a character literal rather than a lifetime.

    Rust spells both with the same tick: 'a' is a char and &'static is a lifetime. Reading
    the lifetime as an open quote blanks the rest of the line, so
    `fn json_small() -> Json<&'static d::PayloadBody> {` strips to
    `fn json_small() -> Json<&`, the brace disappears, and the line reports that it opens
    no block. Every rocket handler is that shape.
    """
    if i + 1 >= len(line):
        return False
    if line[i + 1] == "\\":
        return "'" in line[i + 2:i + 12]
    return i + 2 < len(line) and line[i + 2] == "'"


def strip_code(line, lang):
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
        if c == "'" and lang in CHAR_QUOTE and not char_literal(line, i):
            out.append(c)
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


# Languages where a statement ends at a semicolon, and a balanced line that has not
# reached one is a statement continued on the next. Vert.x writes
# `router.get("/parameters/:one")` on one line and `.handler(...)` on the next, and the
# balanced rule alone captures the route without the handler.
SEMICOLON = ("java", "dotnet")


def ends_statement(line, lang):
    if lang not in SEMICOLON:
        return True
    text = strip_code(line, lang).rstrip()
    return not text or text[-1] in ";{}:"


def block_end(lines, start, lang):
    """The last line of the delimited block opening on `start`.

    Forward to balanced delimiters, per docs/bundles.html §7. A registration that fits on
    one line closes on that line; one that carries a handler body closes wherever the body
    does. A line that opens nothing is its own block, which is what a bare annotation or a
    marker above a declaration needs, and what a declaration with no delimiters at all is.
    """
    depth, opened = 0, False
    for n in range(start, min(len(lines), start + 80)):
        for c in strip_code(lines[n], lang):
            if c in OPEN:
                depth += 1
                opened = True
            elif c in CLOSE:
                depth -= 1
        if opened and depth <= 0 and ends_statement(lines[n], lang):
            return n
        # `var itemsTemplate string` opens nothing and is complete. Scanning on from it
        # would run to whatever the next line with a delimiter closed, which is how a
        # one-line declaration came back holding the two declarations under it. A C# class
        # header opens nothing either and is not complete, which is what the statement rule
        # separates.
        if not opened and ends_statement(lines[n], lang):
            return start
    return start


def indent_of(line):
    return len(line) - len(line.lstrip())


def opens_block(line, lang):
    """Whether this line leaves a delimiter open. A route registration does; a switch case
    label does not, and the two need different end rules."""
    depth = 0
    for c in strip_code(line, lang):
        depth += 1 if c in OPEN else -1 if c in CLOSE else 0
    return depth > 0


def dedent_end(lines, start):
    """The last line of the indentation block opening on `start`.

    What a delimiter count cannot answer: a Python `async def` and a switch case label both
    open a block by indentation alone and balance their own parentheses on their own line.
    """
    base, end = indent_of(lines[start]), start
    for n in range(start + 1, len(lines)):
        if lines[n].strip() and indent_of(lines[n]) <= base:
            break
        end = n
    while end > start and not lines[end].strip():
        end -= 1
    return end


def marked_end(lines, start, lang):
    """The last line of a block a marker labels.

    A mark sits above either a registration, which the balanced rule ends correctly, or a
    switch case, which opens nothing and therefore balances on its own first line. A case
    runs until the source dedents back to it, which is where the next case begins. A C#
    method signature is neither: it balances its parentheses and opens its block on the
    next line, so it needs the statement rule as well.
    """
    if opens_block(lines[start], lang) or not ends_statement(lines[start], lang):
        return block_end(lines, start, lang)
    return dedent_end(lines, start)


def annotation_run(lines, start, end):
    """Whether these lines hold nothing but annotations, attributes and comments."""
    return all(not s or COMMENT.match(s) or ANNOTATION.match(s)
               for s in (l.strip() for l in lines[start:end + 1]))


def declaration_end(lines, start, lang):
    """Where the declaration on `start` ends.

    The same rule a mark gets, because it is the same question: warp writes
    `let etag = warp::path!("etag" / String)` and continues the chain on the lines under it,
    which balances on its first line and is not finished there.

    Python needs its own branch. A decorated `async def` is an indentation block, and the
    balanced rule would end it on the closing paren of its parameter list, which is the
    seam where counting delimiters stops being enough.
    """
    return dedent_end(lines, start) if lang == "python" else marked_end(lines, start, lang)


def through_annotations(lines, start, end, lang):
    """Extend a block that turned out to be only annotations onto what it annotates.

    An annotation balances its own parentheses on its own line, so it is a complete block
    and block_end() stops on it. The declaration underneath is never read, which is how 403
    of the 1485 published snippets came to be a bare `@Get("/json/small")`.

    annotated_start() already walks the other way, from a declaration back over the
    annotations above it. Nothing walked forward, and the route is on the annotation in ten
    of the thirty-three targets.
    """
    if not annotation_run(lines, start, end):
        return end
    for n in range(end + 1, len(lines)):
        s = lines[n].strip()
        if not s or COMMENT.match(s) or ANNOTATION.match(s):
            continue
        return max(end, declaration_end(lines, n, lang))
    return end


def enclosing(lines, start, lang):
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
        for c in strip_code(lines[n], lang):
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


def method_on(lines, line, lang):
    """The HTTP method a route registration on this line names, if it names one.

    Read from the line itself rather than from the framework's API shape, so `app.post(`,
    `r.POST(`, `.delete(` and `@GetMapping` all answer the same way. Without it
    /domain/orders matches its GET and its POST and the endpoint gets the wrong one.
    """
    text = strip_code(lines[line], lang)
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


def comment_at(line, lang):
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
        if c == "'" and lang in CHAR_QUOTE and not char_literal(line, i):
            i += 1
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


def derive(lines, ep, lang):
    """Every place this endpoint's route is registered, as (start, end) line indexes."""
    rx = route_regex(route_of(ep))
    method = ep["method"].lower()
    hits = []
    for n, line in enumerate(lines):
        m = rx.search(line)
        # A route literal also appears in the prose above a neighbouring route. Counting
        # that would make a correct file ambiguous and fail the whole target.
        if not m or m.start() >= comment_at(line, lang):
            continue
        found = method_on(lines, n, lang)
        if found and found != method:
            continue
        start = annotated_start(lines, n)
        hits.append((start, through_annotations(lines, start, block_end(lines, n, lang), lang)))
    return hits


def mark_on(line):
    """The kind a mark line names, or None. rb:end closes a mark and is not one."""
    m = MARK.match(line)
    return m.group(1) if m else None


def expand(selector, selects):
    """The endpoints or families a selector names, or nothing when it names nothing.

    `family.endpoint` is one, `family.*` is all of a family, `*` is the target. Explicit
    `.*` rather than a bare family name, because bare is ambiguous the first time a family
    name and an endpoint name collide.
    """
    family, _, rest = selector.partition(".")
    if selects == "family":
        if selector == "*":
            return list(FAMILIES)
        return [family] if rest == "*" and family in FAMILIES else []
    if selector == "*":
        return [e["id"] for e in ENDPOINTS]
    if rest == "*":
        return [e["id"] for e in ENDPOINTS if e["family"] == family]
    return [selector] if selector in BY_ID else []


def marks(lines, lang):
    """Every rb: mark in the file, and one complaint per mark that names nothing.

      rb:<kind> <selector>[,<selector>...] [<key>=<value>...]
      rb:end

    The kinds live in spec/marks.json, so this never learns one's name: what a kind
    selects, what it may read and what must be true of it are all read from there.

    A mark labels the block under it and runs to the end of that block, or to an rb:end
    where the block rule would stop short of what the author meant. Several marks stacked
    on one block all label it.
    """
    out, bad = [], []
    for n, line in enumerate(lines):
        m = MARK.match(line)
        if not m:
            continue
        kind, rest = m.group(1), m.group(2)
        if kind == "end":
            continue
        if kind not in KINDS:
            bad.append(("rb:%s is not a kind in spec/marks.json" % kind, n))
            continue
        selectors, keys = [], {}
        for token in re.split(r"[,\s]+", rest.strip()):
            if not token:
                continue
            if "=" in token:
                key, _, value = token.partition("=")
                keys[key] = value
            else:
                selectors.append(token)
        subjects, selects = [], KINDS[kind]["selects"]
        for selector in selectors:
            named = expand(selector, selects)
            if not named:
                bad.append(("rb:%s %s names no %s" % (kind, selector, selects), n))
            subjects += named
        if not subjects:
            continue
        # The mark labels the block under it, so the range starts on the next line.
        start = n + 1
        while start < len(lines) and (not lines[start].strip() or mark_on(lines[start])):
            start += 1
        if start >= len(lines):
            continue
        end = through_annotations(lines, start, marked_end(lines, start, lang), lang)
        closed = next((k for k in range(start, len(lines)) if MARK_END.match(lines[k])), None)
        opened = next((k for k in range(start, len(lines))
                       if mark_on(lines[k]) not in (None, "end")), None)
        # An explicit end wins: it is written where the block rule would not have reached.
        if closed is not None and (opened is None or closed < opened):
            end = closed - 1
        out.append({"kind": kind, "subjects": subjects, "keys": keys,
                    "start": start, "end": end, "line": n})
    return out, bad


def part(path, fhash, lines, start, end, how, context=()):
    """One range of one file: where it is, what it says, and what it came from."""
    return {"path": path, "start_line": start + 1, "end_line": end + 1, "hash": fhash,
            "how": how, "text": text_of(lines, start, end), "context": list(context)}


def resolve(language, target, at=None):
    """One record per endpoint this target wires, plus one complaint per problem.

    A record is a handler and the parts that make it work, one key per kind in
    spec/marks.json. Each part is a path, a one-based inclusive line range and the hash of
    the file it came from; the hash is what lets the site refuse to link when history no
    longer holds the bytes that were measured.

    Support parts come from other files than the handler -- express mounts its gzip three
    statements above the route it never mentions -- so each carries its own three rather
    than sharing the handler's. They are keyed by family, because that is the relation:
    six compressed.* endpoints share one set of parts and four cached.* share another.
    """
    files = sources(language, target, at)
    claimed = {kind: {} for kind in KINDS}
    problems = []
    for path, (lines, fhash, role) in files.items():
        found, bad = marks(lines, language)
        problems += ["%s:%s %s (%s:%d)" % (language, target, why, path, n + 1)
                     for why, n in bad]
        for mk in found:
            spec = KINDS[mk["kind"]]
            if role not in spec["roles"]:
                problems.append("%s:%s rb:%s reads %s files and this one is %s (%s:%d)"
                                % (language, target, mk["kind"], "/".join(spec["roles"]),
                                   role, path, mk["line"] + 1))
                continue
            got = part(path, fhash, lines, mk["start"], mk["end"], "marker")
            if mk["keys"]:
                got["keys"] = mk["keys"]
            for subject in mk["subjects"]:
                claimed[mk["kind"]].setdefault(subject, []).append(got)

    out = {}
    for kind, spec in KINDS.items():
        if spec["selects"] != "endpoint":
            continue
        for ep in ENDPOINTS:
            eid, hits, via = ep["id"], list(claimed[kind].get(ep["id"], [])), route_of(ep)
            if not hits and spec.get("derive"):
                hits = derived(language, files, spec["roles"], ep)
            # An endpoint with no route of its own is served by the parameterised route it
            # is an instance of: errors.not_found asks for /domain/orders/999999, which
            # nothing registers, and domain.lookup's /domain/orders/{order} is what
            # answers it. Only an instance qualifies. `base` is otherwise a comparison,
            # not an alias, and following it blindly pointed compressed.small at the
            # /json/small line it is measured against.
            if not hits and spec.get("derive") and ep.get("base") in BY_ID:
                base_route = route_of(BY_ID[ep["base"]])
                if base_route != via and instance_regex(base_route).fullmatch(via):
                    via = base_route
                    hits = derived(language, files, spec["roles"], BY_ID[ep["base"]])
            if not hits:
                continue
            spans = {(h["path"], h["start_line"], h["end_line"]) for h in hits}
            if spec["cardinality"] == "one" and len(spans) > 1:
                where = ", ".join("%s:%d" % (p, s) for p, s, _ in sorted(spans))
                problems.append("%s:%s %s matches in %d places: %s"
                                % (language, target, eid, len(spans), where))
                continue
            got = hits[0]
            names_route = bool(route_regex(via).search(got["text"]))
            if not names_route and not got["context"]:
                got["context"] = enclosing(files[got["path"]][0], got["start_line"] - 1,
                                           language)
            if got["how"] == "derived" and not names_route:
                problems.append("%s:%s %s expanded past its own route (%s:%d-%d)"
                                % (language, target, eid, got["path"],
                                   got["start_line"], got["end_line"]))
                continue
            rec = out.setdefault(eid, {"endpoint": eid, "target": "%s:%s" % (language, target)})
            rec[spec["into"]] = got if spec["cardinality"] == "one" else hits

    # Family-keyed kinds hang off every endpoint of the family, because the page is per
    # endpoint and the relation is per family.
    for kind, spec in KINDS.items():
        if spec["selects"] == "endpoint":
            continue
        for eid, rec in out.items():
            rec[spec["into"]] = list(claimed[kind].get(BY_ID[eid]["family"], []))

    for rec in out.values():
        for spec in KINDS.values():
            rec.setdefault(spec["into"], None if spec["cardinality"] == "one" else [])
    # A record with no handler is not a located endpoint, whatever else claimed it.
    for spec in KINDS.values():
        if spec["required"] == "every":
            out = {eid: rec for eid, rec in out.items() if rec.get(spec["into"])}
    return out, problems


def derived(language, files, roles, ep):
    """Every place this endpoint's route is registered, as parts.

    Derivation is the way in wherever the route literal sits on the declaration, which is
    1162 of the 1485 endpoints. Writing a mark for each of those instead would be 700 to
    900 comment lines in files whose whole job is to read as clean idiomatic framework
    code, and the gate cannot tell the two apart: `how` records which produced a part and
    the requirement matrix checks the claim.
    """
    hits = []
    for path, (lines, fhash, role) in files.items():
        if role not in roles:
            continue
        for start, end in derive(lines, ep, language):
            body = text_of(lines, start, end)
            # A snippet that writes its own route identifies itself and needs nothing
            # more. One that does not is a fragment of a dispatch, and the blocks it is
            # nested in are what make it a handler rather than a condition. See
            # enclosing(). Nothing to report when that comes back empty: a block
            # registering routes from a loop sits at the top level and is self-contained,
            # which is the other thing a mark is for.
            context = [] if route_regex(route_of(ep)).search(body) else \
                enclosing(lines, start, language)
            hits.append(part(path, fhash, lines, start, end, "derived", context))
    return hits


@functools.lru_cache(maxsize=None)
def sources(language, target, at=None):
    """The bundle files any kind may read, as path -> (lines, hash, role).

    The role travels with the file because it is per kind what a file may be read for. A
    handler is target wiring or a host entry point and nothing else; a route literal found
    in the shared domain would be a coincidence. Wiring also reads config, which is where
    a framework that compresses by a setting rather than by code puts it.
    """
    roles = {r for spec in KINDS.values() for r in spec["roles"]}
    out = {}
    for entry in bundle.manifest(language, target, at)["files"]:
        if entry["role"] not in roles:
            continue
        try:
            text = bundle.blob(entry["path"], at).decode("utf-8")
        except UnicodeDecodeError:
            continue
        out[entry["path"]] = (text.splitlines(), entry["hash"], entry["role"])
    return out


# ---- assertions -------------------------------------------------------------------
#
# Locating a snippet is not the same as capturing one. `@Get("/json/small")` contains the
# path it claims, matches in exactly one place, and passes both of the checks above while
# saying nothing about what answers the request. These ask the other question.

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

# The .NET targets reach the domain through an injected DomainModel rather than through
# static calls, so the parameter it was bound to is what a handler actually writes:
# `(DomainModel d) => d.Payload("small")` and `DomainController(DomainModel domain)`.
DOMAIN_BOUND = re.compile(r"\bDomainModel\s+(\w+)")

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
    if language == "dotnet":
        names.update(DOMAIN_BOUND.findall(text))
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


def mechanisms(language, target, at=None):
    """What each family's mechanism is in this target, as spec/matrix.json declares it.

    Read at the commit rather than from the working tree, the way bundle_roots already is:
    a page about a run from March has to say what that target declared in March.
    """
    return bundle.matrix_at(at).get("mechanisms", {}).get("%s:%s" % (language, target), {})


def manifest_text(language, target, at=None):
    """Every dependency manifest in the bundle, concatenated. A declared dependency that is
    not in one of these is a declaration describing a target that no longer exists."""
    out = []
    for entry in bundle.manifest(language, target, at)["files"]:
        if entry["role"] != "manifest":
            continue
        try:
            out.append(bundle.blob(entry["path"], at).decode("utf-8"))
        except UnicodeDecodeError:
            continue
    return "\n".join(out)


def supporting(found):
    """The support parts each family produced, as {family: [part, ...]}."""
    out = {}
    for eid, rec in found.items():
        out.setdefault(BY_ID[eid]["family"], rec["support"])
    return out


def mentioned(decl):
    """The token a family's support has to contain. Defaults to the dependency itself, and
    is written out where the source spells it differently: go.mod carries
    github.com/labstack/echo/v4 and the code writes echo."""
    return decl.get("mentions", decl.get("dep", ""))


# An assertion reads one record, handler and support together.
RECORD_ASSERT = {
    "not_only_annotations": lambda rec, names: only_annotations(rec["handler"]["text"]),
    "reaches_domain": lambda rec, names: not reaches_domain(
        "\n".join(p["text"] for p in [rec["handler"], *rec["support"]]), names),
}

# An assertion reads one family's support against what that family declared.
FAMILY_ASSERT = {
    "mentions_dep": lambda parts, decl: mentioned(decl) not in
    "\n".join(p["text"] for p in parts),
}


def assess(language, target, found, at=None):
    """Which subjects fail each assertion, as {assertion: [endpoint id or family, ...]}.

    Counted rather than fatal. The failures this measures are most of the corpus, so a gate
    that went red on them would block every branch that is fixing them; spec/marks.json
    carries what is allowed and it only ever goes down.
    """
    symbols = shared_symbols(language, target, at)
    files = sources(language, target, at)
    out = {name: [] for name in MARKS["assertions"]}
    for name in out:
        if name not in RECORD_ASSERT and name not in FAMILY_ASSERT:
            raise KeyError("spec/marks.json names the assertion %r and snippets.py does "
                           "not implement it" % name)

    for eid, rec in sorted(found.items()):
        names = set()
        for p in [rec["handler"], *rec["support"]]:
            names |= domain_names(language, "\n".join(files[p["path"]][0]), symbols)
        for name, test in RECORD_ASSERT.items():
            if eid not in MARKS["assertions"][name]["except"] and test(rec, names):
                out[name].append(eid)

    support, declared = supporting(found), mechanisms(language, target, at)
    for family, parts in sorted(support.items()):
        decl = declared.get(family, {})
        if "mechanism" not in decl:
            continue
        for name, test in FAMILY_ASSERT.items():
            if family not in MARKS["assertions"][name]["except"] and test(parts, decl):
                out[name].append(family)
    return out


def requirements(language, target, found, conforming, at=None):
    """What each kind requires of this target, as one complaint per shortfall.

    `every` is the coverage gate: a conformance target answers every endpoint, so it has to
    locate one for each. `declared` reads the per-family mechanism in spec/matrix.json,
    which is where absence has to live: a family a target wires with nothing has no file to
    hold a mark, and without the declaration a missing mark renders an empty section and
    nothing notices.
    """
    out, declared, support = [], mechanisms(language, target, at), supporting(found)
    for kind, spec in KINDS.items():
        if spec["required"] == "every" and conforming:
            missing = [e["id"] for e in ENDPOINTS if not found.get(e["id"], {}).get(spec["into"])]
            if missing:
                out.append("%s:%s is conformance-required and locates a %s for only %d/%d "
                           "endpoints" % (language, target, kind,
                                          len(ENDPOINTS) - len(missing), len(ENDPOINTS)))
        if spec["required"] != "declared":
            continue
        manifests = manifest_text(language, target, at)
        for family in FAMILIES:
            decl = declared.get(family)
            if not decl:
                out.append("%s:%s declares no mechanism for %s in spec/matrix.json"
                           % (language, target, family))
            elif "mechanism" in decl:
                if not support.get(family):
                    out.append("%s:%s declares %s for %s and marks no %s for it"
                               % (language, target, decl["mechanism"], family, kind))
                if decl.get("dep") and decl["dep"] not in manifests:
                    out.append("%s:%s declares %s for %s and no manifest names it"
                               % (language, target, decl["dep"], family))
            elif "builtin" not in decl:
                out.append("%s:%s declares neither a mechanism nor builtin for %s"
                           % (language, target, family))
    return out


def covered(language, target, at=None):
    """How many families this target accounts for, and how."""
    declared = mechanisms(language, target, at)
    wired = sum(1 for f in FAMILIES if "mechanism" in declared.get(f, {}))
    builtin = sum(1 for f in FAMILIES if "builtin" in declared.get(f, {}))
    return wired, builtin


def allowed(language, target):
    return MARKS["allowance"].get("%s:%s" % (language, target), {})


def located(rec):
    """The record without its source: where every part is, and nothing of what it says."""
    def where(v):
        if isinstance(v, list):
            return [where(p) for p in v]
        return {k: x for k, x in v.items() if k != "text"} if isinstance(v, dict) else v
    return {k: where(v) for k, v in rec.items()}


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
        problems += requirements(language, name, found, (language, name) in required, a.at)
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
        from_route = sum(1 for r in found.values() if r["handler"]["how"] == "derived")
        wired, builtin = covered(language, name, a.at)
        if a.summary or a.check or a.ratchet:
            print("%-22s %2d/%d endpoints (%d derived, %d marked)  %2d/%d families "
                  "(%d wired, %d built in)%s"
                  % ("%s:%s" % (language, name), len(found), len(ENDPOINTS),
                     from_route, len(found) - from_route, wired + builtin, len(FAMILIES),
                     wired, builtin, "  %d PROBLEM(S)" % len(problems) if problems else ""))
        else:
            print(json.dumps([located(r) for r in found.values()], indent=2))
        for k in sorted(counts):
            print("  %d %s" % (counts[k], MARKS["assertions"][k]["label"]))
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
