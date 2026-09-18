# rb:test authorized.*,body.*,errors.*
"""What an error endpoint has to answer, which is not what a 2xx endpoint has to answer.

A 2xx body is the controlled variable and spec/expected.json pins it exactly. An error
envelope is the framework's own contract, so what is held is the status, the kind of body, and
the shape this target recorded: the envelope with the values taken out.

The framework-agnostic `errors` block is deliberately not what this reads. That block says
what the plan intends, and a framework may declare otherwise in the client-exception package
beside it. Those packages are TypeScript read by the conformance client, so reconciling the
two is the client's job, and a suite reads what this target recorded instead.
"""
import json

import floor
import planned


def check(a, answer, target):
    recorded = planned.envelope(target, a.key)
    if recorded is None:
        raise AssertionError("%s: spec/expected.json records no envelope for %s" % (a.key, target))
    if answer.status != recorded["status"]:
        raise AssertionError("%s: expected %s, got %s" % (a.key, recorded["status"], answer.status))
    got = floor.body_class(answer.content_type)
    if got != recorded["body_class"]:
        raise AssertionError("%s: expected a %s body, got %s" % (a.key, recorded["body_class"], got))
    try:
        body = json.loads(answer.body) if answer.body else None
    except ValueError:
        body = "unparseable-json"
    have, want = shape_of(body), set(recorded["shape"])
    if have != want:
        raise AssertionError("%s: the envelope shape moved: missing %s, added %s"
                             % (a.key, sorted(want - have), sorted(have - want)))


def shape_of(node, path=""):
    """A port of shape_of() in harness/expected.py, which is what wrote the recorded shapes."""
    kinds = {str: "string", bool: "bool", int: "number", float: "number", type(None): "null"}
    if isinstance(node, dict):
        if not node:
            return {path + "{}"}
        out = set()
        for key, value in node.items():
            out |= shape_of(value, (path + "." if path else "") + key)
        return out
    if isinstance(node, list):
        if not node:
            return {path + "[]"}
        out = set()
        for value in node:
            out |= shape_of(value, path + "[]")
        return out
    return {"%s:%s" % (path, kinds.get(type(node), "other"))}
# rb:end
