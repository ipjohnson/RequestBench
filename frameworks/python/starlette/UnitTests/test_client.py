"""Kiota's client in Client/Kiota, generated from the document Starlette's SchemaGenerator writes,
calling the Implementation in process through httpx's ASGI transport. These hold the client to what
Starlette answers, so they carry no corpus mark."""
import httpx
import pytest
from kiota_abstractions.api_error import APIError
from kiota_abstractions.authentication import AnonymousAuthenticationProvider
from kiota_abstractions.base_request_configuration import RequestConfiguration
from kiota_http.httpx_request_adapter import HttpxRequestAdapter

import expected
from app import build
from expected import RUN
from Kiota.models.checked_order import CheckedOrder
from Kiota.models.line import Line
from Kiota.starlette_client import StarletteClient
from payloads import load

pytestmark = pytest.mark.anyio

BASE = "http://testserver"


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture
async def client():
    transport = httpx.ASGITransport(app=build(load(str(expected.DIRECTORY))))
    async with httpx.AsyncClient(transport=transport, base_url=BASE) as http:
        yield StarletteClient(HttpxRequestAdapter(AnonymousAuthenticationProvider(), http_client=http, base_url=BASE))


async def test_json_small_is_the_payload(client):
    answer = await client.json.small.get()

    small = expected.json("items.small.json")
    assert (answer.size, answer.count) == (small["size"], small["count"])
    assert [row.name for row in answer.items] == [row["name"] for row in small["items"]]


async def test_a_row_is_typed_by_the_documents_item(client):
    answer = await client.items.by_id(17).get()

    assert (answer.id, answer.name, answer.price_cents) == (17, expected.row(17)["name"], expected.row(17)["priceCents"])


async def test_path_and_query_parameters_are_typed(client):
    path = await client.parameters.by_one(RUN["one"]).with_second.by_two(RUN["two"]).get()
    query = await client.query.one.get(RequestConfiguration(query_parameters=client.query.one.OneRequestBuilderGetQueryParameters(page=RUN["page"])))

    assert (path.echo.one, path.echo.two) == (RUN["one"], RUN["two"])
    assert query.echo.page == RUN["page"]


async def test_an_order_is_posted_and_bound(client):
    order = CheckedOrder(customer_id=7, status="open", lines=[Line(product_id=1, qty=2)])

    answer = await client.body.validate.small.post(order)

    assert (answer.fields, answer.echo.customer_id, answer.echo.lines[0].qty) == (4, 7, 2)


async def test_a_refused_order_reaches_the_caller_as_kiotas_api_error_with_422(client):
    with pytest.raises(APIError) as refused:
        await client.body.validate.small.post(CheckedOrder(customer_id=0, status="", lines=[]))

    assert refused.value.response_status_code == 422
