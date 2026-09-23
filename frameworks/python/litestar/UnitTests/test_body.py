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


# rb:test body.rejected_all,body.rejected_first
@pytest.mark.corpus("body.rejected_all", "body.rejected_first")
@pytest.mark.parametrize("path", ["/body/validate/small", "/body/validate/first-error"])
def test_msgspec_stops_at_the_first_rule_order_invalid_breaks(client, path):
    response = client.post(path, content=expected.raw("order.invalid.json"), headers=JSON)

    assert response.status_code == 400
    assert response.json() == {
        "status_code": 400,
        "detail": f"Validation failed for POST {path}",
        "extra": [{"message": "Expected `int` >= 1", "key": "customerId", "source": "body"}],
    }


def test_a_rule_inside_a_line_is_named_by_its_path(client):
    body = b'{"customerId":1,"status":"open","lines":[{"productId":1,"qty":0},{"productId":0,"qty":1}]}'

    response = client.post("/body/validate/small", content=body, headers=JSON)

    assert response.json()["extra"] == [{"message": "Expected `int` >= 1", "key": "lines[0].qty", "source": "body"}]


def test_the_bind_routes_check_no_rule(client):
    response = client.post("/body/bind/small", content=expected.raw("order.invalid.json"), headers=JSON)

    assert response.status_code == 200
    assert response.json()["fields"] == 2


def test_a_number_sent_as_a_string_is_converted(client):
    body = b'{"customerId":"7","status":"open","lines":[{"productId":1,"qty":1}]}'

    response = client.post("/body/validate/small", content=body, headers=JSON)

    assert response.status_code == 200
    assert response.json()["echo"]["customerId"] == 7
