"""Boot every target, ask it every endpoint, check what it answered against
spec/expected.json.

There is one thing this suite refuses to do, and it is the reason it exists: it never
compares a target against another target. spec/expected.json is the authority. A target
that disagrees with it fails, however many other targets share the mistake.

A target is booted once per session and asked every distinct request in spec/plan.json in
one pass. The answers are held and the tests assert over them, so 3,346 requests are sent
per target rather than per test.

  make test                                  every implemented target, in containers
  make test TARGETS=python:flask             one of them
  make test MODE=local                       host processes, for a quick loop
"""
import json
import pathlib
import sys

import pytest

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "harness"))

import bundle  # noqa: E402
import expected as expectation  # noqa: E402

PLAN = json.loads((ROOT / "spec" / "plan.json").read_text())


def pytest_addoption(parser):
    parser.addoption("--rb-mode", choices=["local", "docker"], default="docker",
                     help="how to boot each target. docker is what measurement uses")
    parser.addoption("--rb-targets", default="",
                     help="language:target,... Default: every implemented target")


def chosen_targets(config):
    every = ["%s:%s" % p for p in bundle.implemented()]
    named = [t.strip() for t in config.getoption("rb_targets").split(",") if t.strip()]
    if not named:
        return every
    unknown = [t for t in named if t not in every]
    if unknown:
        raise pytest.UsageError("not an implemented target: %s" % ", ".join(unknown))
    return [t for t in every if t in named]


def pytest_generate_tests(metafunc):
    # Session scope so pytest groups every test for one target together. Without it the
    # run walks families first and reboots nothing, but holds all twenty-eight captures in
    # memory at once for no reason.
    if "target" in metafunc.fixturenames:
        metafunc.parametrize("target", chosen_targets(metafunc.config), scope="session")


@pytest.fixture(scope="session")
def expected():
    """The committed expectation, refused outright if it describes a different spec."""
    return expectation.load()


@pytest.fixture(scope="session")
def answers(request):
    """What a target answered, booted on first ask and kept for the rest of the session."""
    held, mode = {}, request.config.getoption("rb_mode")

    def of(target):
        if target not in held:
            language, _, name = target.partition(":")
            held[target] = expectation.boot_and_capture(language, name, mode)
        return held[target]

    return of
