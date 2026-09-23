from collections.abc import Iterator

import pytest
from litestar import Litestar
from litestar.testing import TestClient

from app import build
from expected import DIRECTORY
from payloads import load


@pytest.fixture(scope="module")
def client() -> Iterator[TestClient[Litestar]]:
    """The Implementation, built as each worker builds it, under Litestar's TestClient, which is
    what Litestar's testing guide uses. One per test module, so each module's cache starts empty."""
    with TestClient(build(load(str(DIRECTORY)))) as client:
        yield client
