import pytest

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


def test_an_account_that_is_no_int_is_drfs_400(client):
    response = client.get("/headers/bind", headers=headers(0) | {"x-rb-account": "many"})

    assert response.status_code == 400
    assert response.json() == ["a bound header is missing or no int: invalid literal for int() with base 10: 'many'"]
