import os

import django
import pytest

from expected import DIRECTORY

# The Implementation, set up as wsgi.py sets it up in each worker. settings.py loads the payloads
# RB_PAYLOADS names, which rb suite sets and expected.py otherwise finds.
os.environ.setdefault("RB_PAYLOADS", str(DIRECTORY))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "settings")
django.setup()

from rest_framework.test import APIClient  # noqa: E402


@pytest.fixture
def client() -> APIClient:
    """DRF's APIClient, which sends each request through Django's handler, the middleware and the
    URLconf that wsgi.py serves, with no socket. Each worker keeps one cache and one serial counter,
    and so does the suite."""
    return APIClient()
