import pytest
from starlette.testclient import TestClient

import expected
from expected import RUN


def headers(unread: int) -> dict[str, str]:
    """The three headers the binding rows bind, and as many more as asked that nothing reads. The
    many rows send twenty-five of those."""
    sent = {"x-rb-tenant": RUN["tenant"], "x-rb-request-id": RUN["requestId"], "x-rb-account": str(RUN["account"])}
    return sent | {f"x-rb-unread-{i}": "unread" for i in range(unread)}


# rb:test headers.few,headers.many
@pytest.mark.corpus("headers.few", "headers.many")
@pytest.mark.parametrize("unread", [0, 25])
def test_headers_nothing_reads_leave_the_answer_alone(client, unread):
    response = client.get("/headers", headers=headers(unread))

    assert response.json() == expected.json("items.small.json")


# rb:test headers.bind_few,headers.bind_many
@pytest.mark.corpus("headers.bind_few", "headers.bind_many")
@pytest.mark.parametrize("unread", [0, 25])
def test_three_headers_are_bound_and_echoed_the_account_as_an_int(client, unread):
    response = client.get("/headers/bind", headers=headers(unread))

    echo = {"tenant": RUN["tenant"], "requestId": RUN["requestId"], "account": RUN["account"]}
    assert response.json() == expected.with_echo("items.small.json", echo)


def test_an_account_that_is_not_an_int_is_refused_by_spectree(client):
    response = client.get("/headers/bind", headers=headers(0) | {"x-rb-account": "many"})

    assert response.status_code == 422
    assert response.json()[0]["loc"] == ["x-rb-account"]


def test_a_missing_header_is_a_500_because_its_refusal_holds_the_headers(client):
    """SpecTree writes Pydantic's failures with their input, and a missing field's input is the whole
    of Starlette's Headers, which json cannot serialise. Starlette answers the TypeError with 500."""
    lenient = TestClient(client.app, raise_server_exceptions=False)

    response = lenient.get("/headers/bind", headers={"x-rb-tenant": RUN["tenant"]})

    assert response.status_code == 500
