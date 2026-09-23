import pytest

import expected

JSON = "application/json"


def post(client, path: str, body: bytes):
    return client.post(path, data=body, content_type=JSON)


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

    response = post(client, path, body)

    order = expected.json(file)
    assert response.status_code == 200
    assert response.json == {"fields": 2 + 2 * len(order["lines"]), "bytes": len(body), "echo": order}


# rb:test body.rejected_all
@pytest.mark.corpus("body.rejected_all")
def test_flask_pydantic_refuses_order_invalid_naming_every_rule_it_breaks(client):
    response = post(client, "/body/validate/small", expected.raw("order.invalid.json"))

    assert response.status_code == 400
    assert [e["loc"] for e in response.json["validation_error"]["body_params"]] == [["customerId"], ["status"], ["lines"]]


# rb:test body.rejected_first
@pytest.mark.corpus("body.rejected_first")
def test_the_first_error_route_stops_at_the_first_rule(client):
    response = post(client, "/body/validate/first-error", expected.raw("order.invalid.json"))

    assert response.status_code == 400
    assert response.json == {"validation_error": {"body_params": [{
        "type": "greater_than",
        "loc": ["customerId"],
        "msg": "Input should be greater than 0",
        "input": 0,
        "ctx": {"gt": 0},
        "url": "https://errors.pydantic.dev/2.13/v/greater_than",
    }]}}


def test_the_first_error_route_answers_what_the_model_would_for_that_rule(client):
    body = b'{"customerId":1,"status":"open","lines":[{"productId":1,"qty":0},{"productId":0,"qty":1}]}'

    first = post(client, "/body/validate/first-error", body).json["validation_error"]["body_params"]
    every = post(client, "/body/validate/small", body).json["validation_error"]["body_params"]

    assert first == every[:1]
    assert first[0]["loc"] == ["lines", 0, "qty"]


def test_the_first_error_route_binds_a_valid_order(client):
    response = post(client, "/body/validate/first-error", expected.raw("order.small.json"))

    assert response.status_code == 200
    assert response.json["echo"] == expected.json("order.small.json")


def test_the_bind_routes_check_no_rule(client):
    response = post(client, "/body/bind/small", expected.raw("order.invalid.json"))

    assert response.status_code == 200
    assert response.json["fields"] == 2
