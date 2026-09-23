import pytest
from starlette.testclient import TestClient

import expected

JSON = {"content-type": "application/json"}


# rb:test body.bind_small,body.bind_medium,body.validate_small,body.validate_medium
@pytest.mark.corpus("body.bind_small", "body.bind_medium", "body.validate_small", "body.validate_medium")
@pytest.mark.parametrize(("path", "file"), [
    ("/body/bind/small", "order.small.json"),
    ("/body/bind/medium", "order.medium.json"),
    ("/body/validate/small", "order.small.json"),
    ("/body/validate/medium", "order.medium.json"),
])
def test_an_order_is_answered_with_its_leaves_its_length_and_itself(client, path, file):
    body = expected.raw(file)

    response = client.post(path, content=body, headers=JSON)

    order = expected.json(file)
    assert response.status_code == 200
    assert response.json() == {"fields": 2 + 2 * len(order["lines"]), "bytes": len(body), "echo": order}


# rb:test body.rejected_all
@pytest.mark.corpus("body.rejected_all")
def test_spectree_refuses_order_invalid_naming_every_rule_it_breaks(client):
    response = client.post("/body/validate/small", content=expected.raw("order.invalid.json"), headers=JSON)

    assert response.status_code == 422
    assert [e["loc"] for e in response.json()] == [["customerId"], ["status"], ["lines"]]


# rb:test body.rejected_first
@pytest.mark.corpus("body.rejected_first")
def test_the_first_error_route_stops_at_the_first_rule(client):
    response = client.post("/body/validate/first-error", content=expected.raw("order.invalid.json"), headers=JSON)

    assert response.status_code == 422
    [failure] = response.json()
    assert failure.pop("url").startswith("https://errors.pydantic.dev/")
    assert failure == {"type": "greater_than", "loc": ["customerId"], "msg": "Input should be greater than 0", "input": 0}


def test_the_first_error_route_answers_what_the_model_would_for_that_rule(client):
    body = b'{"customerId":1,"status":"open","lines":[{"productId":1,"qty":0},{"productId":0,"qty":1}]}'

    first = client.post("/body/validate/first-error", content=body, headers=JSON).json()
    every = client.post("/body/validate/small", content=body, headers=JSON).json()

    assert first == every[:1]
    assert first[0]["loc"] == ["lines", 0, "qty"]


def test_the_first_error_route_binds_a_valid_order(client):
    response = client.post("/body/validate/first-error", content=expected.raw("order.small.json"), headers=JSON)

    assert response.status_code == 200
    assert response.json()["echo"] == expected.json("order.small.json")


def test_the_bind_routes_check_no_rule(client):
    response = client.post("/body/bind/small", content=expected.raw("order.invalid.json"), headers=JSON)

    assert response.status_code == 200
    assert response.json()["fields"] == 2


def test_a_body_whose_type_has_a_charset_is_not_validated_and_fails_in_the_endpoint(client):
    """SpecTree validates a body only when its content type is exactly application/json. With a
    charset the endpoint finds no order, and Starlette answers the AttributeError with 500."""
    lenient = TestClient(client.app, raise_server_exceptions=False)

    response = lenient.post("/body/validate/small", content=expected.raw("order.small.json"),
                            headers={"content-type": "application/json; charset=utf-8"})

    assert response.status_code == 500
