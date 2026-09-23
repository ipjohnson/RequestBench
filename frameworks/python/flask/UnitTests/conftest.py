import pytest
from flask.testing import FlaskClient

from app import build
from expected import DIRECTORY
from payloads import load


@pytest.fixture(scope="module")
def client() -> FlaskClient:
    """The Implementation, built as each gunicorn worker builds it, under Flask's test client, which
    is what Flask's testing guide uses. One per test module, so each module's cache starts empty."""
    return build(load(str(DIRECTORY))).test_client()
