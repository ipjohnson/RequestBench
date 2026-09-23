import pytest

import expected

JSON = {"content-type": "application/json"}


def failed(message: str) -> list[str]:
    """The fields a sanic-ext refusal names: each line of Pydantic's account that is not indented."""
    return [line for line in message.splitlines()[1:] if not line.startswith(" ")]


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
    assert response.json == {"fields": 2 + 2 * len(order["lines"]), "bytes": len(body), "echo": order}


# rb:test body.rejected_all
@pytest.mark.corpus("body.rejected_all")
def test_the_model_refuses_order_invalid_naming_every_rule_it_breaks(client):
    response = client.post("/body/validate/small", content=expected.raw("order.invalid.json"), headers=JSON)

    assert response.status_code == 400
    assert response.json["message"].startswith("Invalid request body: CheckedOrder. Error: 3 validation errors")
    assert failed(response.json["message"]) == ["customerId", "status", "lines"]


# rb:test body.rejected_first
@pytest.mark.corpus("body.rejected_first")
def test_the_first_error_route_stops_at_the_first_rule(client):
    response = client.post("/body/validate/first-error", content=expected.raw("order.invalid.json"), headers=JSON)

    assert response.status_code == 400
    assert response.json == {
        "description": "Bad Request",
        "status": 400,
        "message": "Invalid request body: CheckedOrder. Error: 1 validation error for CheckedOrder\n"
                   "customerId\n"
                   "  Input should be greater than 0 [type=greater_than, input_value=0, input_type=int]\n"
                   "    For further information visit https://errors.pydantic.dev/2.13/v/greater_than",
    }


def test_the_first_error_route_answers_what_the_model_would_for_that_rule(client):
    body = b'{"customerId":1,"status":"open","lines":[{"productId":1,"qty":0},{"productId":0,"qty":1}]}'

    first = client.post("/body/validate/first-error", content=body, headers=JSON).json["message"]
    every = client.post("/body/validate/small", content=body, headers=JSON).json["message"]

    assert failed(first) == failed(every)[:1] == ["lines.0.qty"]
    assert first.splitlines()[1:] == every.splitlines()[1:4]


def test_the_first_error_route_binds_a_valid_order(client):
    response = client.post("/body/validate/first-error", content=expected.raw("order.small.json"), headers=JSON)

    assert response.status_code == 200
    assert response.json["echo"] == expected.json("order.small.json")


def test_the_bind_routes_check_no_rule(client):
    response = client.post("/body/bind/small", content=expected.raw("order.invalid.json"), headers=JSON)

    assert response.status_code == 200
    assert response.json["fields"] == 2
