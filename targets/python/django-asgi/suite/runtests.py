# rb:test *
"""Django's own test runner, run the way its documentation runs a reusable app's tests.

Django does not use pytest. Its tests are unittest classes run by DiscoverRunner, and for code
that is not a project with a manage.py the documentation's answer is this file: configure,
call get_runner(settings) and hand it the tests. This target configures itself when it is
imported, so importing it is the configure step.

The runner does work the other five suites do not: it switches the test environment on,
which among other things adds testserver to ALLOWED_HOSTS, and it runs Django's system checks
before any test. Neither is visible from a pytest suite, and both are part of what running
this target's tests costs.
"""
import os
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
TARGET = HERE.parent
# The target imports _hosts and _shared from targets/python, and is itself a module called
# app beside five others of the same name, so each suite runs on its own.
sys.path[:0] = [str(HERE), str(TARGET), str(TARGET.parent)]

import planned  # noqa: E402

# app.py reads the fixture at import, through a relative fallback that resolves against the
# directory harness/run.py starts a target in. A test runs from somewhere else.
os.environ["RB_FIXTURE"] = str(planned.ROOT / "spec" / "fixture.json")

import app  # noqa: E402,F401  configures settings and calls django.setup()
from django.conf import settings  # noqa: E402
from django.test.utils import get_runner  # noqa: E402

if __name__ == "__main__":
    runner = get_runner(settings)(top_level=str(HERE), verbosity=1)
    sys.exit(bool(runner.run_tests([str(HERE)])))
# rb:end
