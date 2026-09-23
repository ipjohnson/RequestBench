import socket

import pytest
from sanic_testing.reusable import ReusableClient
from sanic_testing.testing import TestingResponse

from app import build
from expected import DIRECTORY
from payloads import load


class Client:
    """sanic-testing's ReusableClient, which keeps Sanic's own server up for every request of a test
    module, answering each request with its response alone."""

    def __init__(self, server: ReusableClient) -> None:
        self.server = server

    def send(self, method: str, uri: str, **kwargs) -> TestingResponse:
        # gather_request=False, because gathering adds a middleware to every route on every request.
        _, response = getattr(self.server, method)(uri, gather_request=False, **kwargs)
        return response

    def get(self, uri: str, **kwargs) -> TestingResponse:
        return self.send("get", uri, **kwargs)

    def head(self, uri: str, **kwargs) -> TestingResponse:
        return self.send("head", uri, **kwargs)

    def post(self, uri: str, **kwargs) -> TestingResponse:
        return self.send("post", uri, **kwargs)

    def put(self, uri: str, **kwargs) -> TestingResponse:
        return self.send("put", uri, **kwargs)

    def patch(self, uri: str, **kwargs) -> TestingResponse:
        return self.send("patch", uri, **kwargs)

    def delete(self, uri: str, **kwargs) -> TestingResponse:
        return self.send("delete", uri, **kwargs)

    def options(self, uri: str, **kwargs) -> TestingResponse:
        return self.send("options", uri, **kwargs)


def free_port() -> int:
    """A port no one holds, found by binding port 0. ReusableClient reads 0 as a random port."""
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        return probe.getsockname()[1]


@pytest.fixture(scope="module")
def client():
    """The Implementation, built as each worker builds it and served by Sanic's own server, as
    Sanic's testing guide serves it. One per test module, so each module's cache starts empty."""
    with ReusableClient(build(load(str(DIRECTORY))), port=free_port()) as server:
        yield Client(server)
