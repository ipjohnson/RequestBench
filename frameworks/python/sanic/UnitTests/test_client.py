"""The Kiota client in Client/Kiota, generated from the document sanic-ext writes, calling the
Implementation under Sanic's own server. These hold the client to what Sanic answers, so they carry
no corpus marks."""
import asyncio
import os
import signal
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

import pytest
from Kiota.models.checked_order import CheckedOrder
from Kiota.models.line import Line
from Kiota.models.refusal import Refusal
from Kiota.query.one.one_request_builder import OneRequestBuilder
from Kiota.sanic_client import SanicClient
from kiota_abstractions.authentication.anonymous_authentication_provider import AnonymousAuthenticationProvider
from kiota_abstractions.base_request_configuration import RequestConfiguration
from kiota_http.httpx_request_adapter import HttpxRequestAdapter

import expected
from conftest import free_port
from expected import RUN

IMPLEMENTATION = Path(__file__).resolve().parent.parent / "Implementation"


@pytest.fixture(scope="module")
def base():
    """server.py on a free port, as the image runs it, with its two workers."""
    port = free_port()
    # A session of its own, so the teardown can reach the workers and the manager's helper processes.
    server = subprocess.Popen([sys.executable, str(IMPLEMENTATION.parent / "container-h1" / "server.py")], cwd=IMPLEMENTATION, stderr=subprocess.DEVNULL,
                              start_new_session=True,
                              env={**os.environ, "PORT": str(port), "RB_PAYLOADS": str(expected.DIRECTORY)})
    url = f"http://127.0.0.1:{port}"
    try:
        for _ in range(300):
            try:
                with urllib.request.urlopen(f"{url}/health"):
                    break
            except OSError:
                time.sleep(0.05)
        else:
            raise RuntimeError("server.py did not answer /health")
        yield url
    finally:
        server.terminate()
        try:
            server.wait(timeout=10)
        except subprocess.TimeoutExpired:
            # Sanic's main process can hang on a SIGTERM that arrives before it has seen both workers
            # start, which these tests do within a second. The README's Notes say why.
            os.killpg(server.pid, signal.SIGKILL)
            server.wait()


def call(base: str, ask):
    """Runs ask with a SanicClient whose adapter sends to base."""
    async def run():
        adapter = HttpxRequestAdapter(AnonymousAuthenticationProvider())
        adapter.base_url = base
        return await ask(SanicClient(adapter))
    return asyncio.run(run())


def test_json_small_is_the_payload(base):
    answer = call(base, lambda client: client.json.small.get())

    small = expected.json("items.small.json")
    assert (answer.size, answer.count) == (small["size"], small["count"])
    assert [(row.id, row.name, row.price_cents, row.in_stock) for row in answer.items] == \
        [(row["id"], row["name"], row["priceCents"], row["inStock"]) for row in small["items"]]


def test_a_row_is_typed_by_the_documented_answer(base):
    answer = call(base, lambda client: client.items.by_id(17).get())

    assert (answer.id, answer.name, answer.category) == (17, expected.row(17)["name"], expected.row(17)["category"])


def test_a_query_parameter_on_the_query_routes(base):
    page = OneRequestBuilder.OneRequestBuilderGetQueryParameters()
    page.page = RUN["page"]

    answer = call(base, lambda client: client.query.one.get(RequestConfiguration(query_parameters=page)))

    assert answer.echo.page == RUN["page"]


def test_two_path_parameters(base):
    answer = call(base, lambda client: client.parameters.by_one(RUN["one"]).with_second.by_two(RUN["two"]).get())

    assert (answer.echo.one, answer.echo.two) == (RUN["one"], RUN["two"])


def test_an_order_is_sent_and_bound(base):
    order = CheckedOrder(customer_id=1, status="open", lines=[Line(product_id=1, qty=1)])

    answer = call(base, lambda client: client.body.validate.small.post(order))

    assert (answer.fields, answer.echo.customer_id, answer.echo.lines[0].qty) == (4, 1, 1)


def test_a_refusal_is_the_documented_model(base):
    order = CheckedOrder(customer_id=0, status="", lines=[])

    with pytest.raises(Refusal) as refused:
        call(base, lambda client: client.body.validate.small.post(order))

    assert refused.value.response_status_code == 400
    assert refused.value.message.startswith("Invalid request body: CheckedOrder.")
