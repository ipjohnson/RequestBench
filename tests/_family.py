"""One test per target per endpoint, built the same way for every family.

The thirteen family files are three lines each and all of the checking is here, because a
family is a grouping of endpoints and not a different kind of assertion. Splitting them
buys a readable failure line -- `test_compressed.py::test_endpoint[python:flask-gzip_large]`
says what broke without opening anything -- and the ability to run one family while
rewiring a target.
"""
import json
import pathlib
import sys

import pytest

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "harness"))

import conform  # noqa: E402
from expected import keys_of  # noqa: E402

PLAN = json.loads((ROOT / "spec" / "plan.json").read_text())


def endpoints(family):
    return [e for e in PLAN["endpoints"] if e["family"] == family]


def difference(key, want, got):
    """Why one request's answer is not the expected one, or None.

    Status first, then the kind of body, then the body itself. A target answering the
    right values with the wrong content-type is not answering correctly, and checking the
    body first would report that as a pass.
    """
    if got["status"] != want["status"]:
        return "%s: expected %d, got %d" % (key, want["status"], got["status"])
    if got["body_class"] != want["body_class"]:
        return "%s: expected a %s body, got %s" % (key, want["body_class"], got["body_class"])
    # A null expectation is a field spec/expected.json deliberately does not pin; its
    # "unpinned" block says which and what each contributor answered.
    if want.get("encoding") is not None and got.get("encoding", "") != want.get("encoding", ""):
        return "%s: expected content-encoding %r, got %r" % (
            key, want.get("encoding") or "identity", got.get("encoding") or "identity")
    diff = conform.first_difference(got["body"], want["body"])
    return "%s: %s" % (key, diff) if diff else None


def build(family):
    eps = endpoints(family)

    @pytest.mark.parametrize("endpoint", eps, ids=[e["id"].split(".", 1)[1] for e in eps])
    def test_endpoint(target, endpoint, answers, expected):
        got, want = answers(target), expected["requests"]
        missing = [k for k in keys_of(endpoint) if k not in want]
        if missing:
            pytest.fail("spec/expected.json says nothing about %d request(s) of %s, "
                        "starting with %s" % (len(missing), endpoint["id"], missing[0]))

        problems = []
        for key in keys_of(endpoint):
            if key not in got:
                problems.append("%s: the target was never asked" % key)
                continue
            why = difference(key, want[key], got[key])
            if why:
                problems.append(why)
        if problems:
            # One line per distinct complaint. An endpoint has up to 512 instances and they
            # usually fail identically, so listing every one of them hides how many
            # different things are wrong.
            seen = dict.fromkeys(p.split(": ", 1)[1] for p in problems)
            pytest.fail("%s: %d/%d request(s) wrong\n  %s"
                        % (endpoint["id"], len(problems), len(keys_of(endpoint)),
                           "\n  ".join(seen)))

    return test_endpoint
