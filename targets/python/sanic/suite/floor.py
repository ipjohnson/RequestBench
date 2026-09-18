# rb:test *
"""What every test asserts before it asserts anything of its own.

A port of difference() in client/src/expectation.ts, in its order and with its rules. The
order is the point: a target answering the right values as text/plain is not answering
correctly, so the kind of body is checked before the body. A suite stricter than the client
fails a target the client passes, and a looser one passes a target `make test` rejects.
"""
import json
import re
from typing import Mapping, NamedTuple


class Answer(NamedTuple):
    status: int
    content_type: str
    encoding: str
    # The body after httpx decoded it. sanic-testing reads every response in full and hands
    # back no raw stream, so this is the one suite where the bytes as sent are unreachable.
    body: bytes
    headers: Mapping[str, str]


def check(a, answer):
    """Assert the pinned answer, or fail naming the first thing that differs."""
    why = difference(a.want, answer)
    if why:
        raise AssertionError("%s: %s" % (a.key, why))


def difference(want, answer):
    if answer.status != want["status"]:
        return "expected %s, got %s" % (want["status"], answer.status)
    # A null is a field spec/expected.json deliberately does not pin; its "unpinned" block
    # says which. compressed.gzip_small is the one this suite meets.
    got = body_class(answer.content_type)
    if want["body_class"] is not None and got != want["body_class"]:
        return "expected a %s body, got %s" % (want["body_class"], got)
    if want["encoding"] is not None and answer.encoding != want["encoding"]:
        return "expected content-encoding %s, got %s" % (want["encoding"] or "identity",
                                                         answer.encoding or "identity")
    return first_difference(comparable(answer.body, answer.content_type), want["body"])


def body_class(content_type):
    ctype = content_type.lower()
    if "json" in ctype:
        return "json"
    if "html" in ctype:
        return "html"
    if "text" in ctype:
        return "text"
    return "none" if not ctype else "other"


# There is no decoded() here, which is the other five suites' way of undoing gzip before
# comparing. httpx has already undone it by the time sanic-testing returns, so the encoding
# is checked on the content-encoding header alone. That is still a real check: httpx raises
# on a body the header describes wrongly, so a response that arrived at all with gzip in the
# header was gzip on the wire.


def comparable(raw, content_type):
    """The response as a value rather than as bytes, so key order and 18928 against 18928.0
    stop mattering."""
    if not raw:
        return None
    if "json" in content_type:
        try:
            return json.loads(raw)
        except ValueError:
            return "unparseable-json"
    text = raw.decode("utf-8")
    if "html" in content_type:
        # Five template engines cannot agree on formatting, so the spec pins content and
        # leaves whitespace free: same elements, same order, same values.
        text = re.sub(r"[ \t\n\r\f\v]+", " ", text)
        text = re.sub(r"> +", ">", text)
        text = re.sub(r" +<", "<", text).strip()
    return text


def type_name(v):
    # bool before int, because in Python a bool is an int, and the client does not let
    # True answer for 1.
    return "bool" if isinstance(v, bool) else type(v).__name__


def first_difference(a, b, path="response"):
    ta, tb = type_name(a), type_name(b)
    if ta != tb and not (ta in ("int", "float") and tb in ("int", "float")):
        return "%s: %s vs %s" % (path, ta, tb)
    if isinstance(a, dict):
        for k in sorted(set(a) | set(b)):
            if k not in a:
                return "%s.%s: missing here, present in the reference" % (path, k)
            if k not in b:
                return "%s.%s: present here, missing in the reference" % (path, k)
            d = first_difference(a[k], b[k], "%s.%s" % (path, k))
            if d:
                return d
        return None
    if isinstance(a, list):
        if len(a) != len(b):
            return "%s: %d items vs %d" % (path, len(a), len(b))
        for i, (x, y) in enumerate(zip(a, b)):
            d = first_difference(x, y, "%s[%d]" % (path, i))
            if d:
                return d
        return None
    return None if a == b else "%s: %r vs %r" % (path, a, b)
# rb:end
