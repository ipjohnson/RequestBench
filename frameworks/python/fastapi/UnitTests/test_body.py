import pytest

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
def test_the_model_refuses_order_invalid_naming_every_rule_it_breaks(client):
    response = client.post("/body/validate/small", content=expected.raw("order.invalid.json"), headers=JSON)

    assert response.status_code == 422
    assert [e["loc"] for e in response.json()["detail"]] == [["body", "customerId"], ["body", "status"], ["body", "lines"]]


# rb:test body.rejected_first
@pytest.mark.corpus("body.rejected_first")
def test_the_first_error_route_stops_at_the_first_rule(client):
    response = client.post("/body/validate/first-error", content=expected.raw("order.invalid.json"), headers=JSON)

    assert response.status_code == 422
    assert response.json() == {"detail": [{
        "type": "greater_than",
        "loc": ["body", "customerId"],
        "msg": "Input should be greater than 0",
        "input": 0,
        "ctx": {"gt": 0},
    }]}


def test_the_first_error_route_answers_what_the_model_would_for_that_rule(client):
    body = b'{"customerId":1,"status":"open","lines":[{"productId":1,"qty":0},{"productId":0,"qty":1}]}'

    first = client.post("/body/validate/first-error", content=body, headers=JSON).json()["detail"]
    every = client.post("/body/validate/small", content=body, headers=JSON).json()["detail"]

    assert first == every[:1]
    assert first[0]["loc"] == ["body", "lines", 0, "qty"]


def test_the_first_error_route_binds_a_valid_order(client):
    response = client.post("/body/validate/first-error", content=expected.raw("order.small.json"), headers=JSON)

    assert response.status_code == 200
    assert response.json()["echo"] == expected.json("order.small.json")


def test_the_bind_routes_check_no_rule(client):
    response = client.post("/body/bind/small", content=expected.raw("order.invalid.json"), headers=JSON)

    assert response.status_code == 200
    assert response.json()["fields"] == 2
