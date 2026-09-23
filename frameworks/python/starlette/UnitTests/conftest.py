import pytest
from starlette.testclient import TestClient

from app import build
from expected import DIRECTORY
from payloads import load


@pytest.fixture(scope="module")
def client() -> TestClient:
    """The Implementation, built as each worker builds it, under Starlette's TestClient, which is
    what Starlette's testing guide uses. One per test module, so each module's cache starts empty."""
    return TestClient(build(load(str(DIRECTORY))))
