import os

import django
import pytest

from expected import DIRECTORY

# The Implementation, set up as asgi.py sets it up in each worker. settings.py loads the payloads
# RB_PAYLOADS names, which rb suite sets and expected.py otherwise finds.
os.environ.setdefault("RB_PAYLOADS", str(DIRECTORY))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "settings")
django.setup()

from django.test import AsyncClient  # noqa: E402


@pytest.fixture
def client() -> AsyncClient:
    """Django's AsyncClient, which sends each request through the asynchronous handler, the
    middleware and the URLconf that asgi.py serves, with no socket. Each worker keeps one cache and
    one serial counter, and so does the suite."""
    return AsyncClient()
