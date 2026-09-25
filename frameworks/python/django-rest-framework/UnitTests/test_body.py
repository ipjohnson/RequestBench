import pytest

import expected

JSON = "application/json"


def post(client, path: str, body: bytes):
    return client.post(path, body, content_type=JSON)


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
    assert response.json() == {"fields": 2 + 2 * len(order["lines"]), "bytes": len(body), "echo": order}
# rb:end


# rb:test body.rejected_all
@pytest.mark.corpus("body.rejected_all")
def test_the_serializer_refuses_order_invalid_naming_every_rule_it_breaks(client):
    response = post(client, "/body/validate/small", expected.raw("order.invalid.json"))

    assert response.status_code == 400
    assert response.json() == {
        "customerId": ["Ensure this value is greater than or equal to 1."],
        "status": ["This field may not be blank."],
        "lines": {"non_field_errors": ["This list may not be empty."]},
    }


# rb:test body.rejected_first
@pytest.mark.corpus("body.rejected_first")
def test_the_first_error_route_stops_at_the_first_field(client):
    response = post(client, "/body/validate/first-error", expected.raw("order.invalid.json"))

    assert response.status_code == 400
    assert response.json() == {"customerId": ["Ensure this value is greater than or equal to 1."]}


def test_the_first_error_route_answers_what_the_full_check_lists_first(client):
    body = b'{"customerId":1,"status":"","lines":[{"productId":1,"qty":0}]}'

    first = post(client, "/body/validate/first-error", body).json()
    every = post(client, "/body/validate/small", body).json()

    assert first == {"status": every["status"]}
    assert list(every) == ["status", "lines"]


def test_each_line_is_held_to_the_line_serializer_and_keyed_by_its_index(client):
    body = b'{"customerId":1,"status":"open","lines":[{"productId":1,"qty":1},{"productId":1,"qty":0},{"productId":0,"qty":1}]}'

    response = post(client, "/body/validate/small", body)

    assert response.status_code == 400
    assert response.json() == {"lines": {
        "1": {"qty": ["Ensure this value is greater than or equal to 1."]},
        "2": {"productId": ["Ensure this value is greater than or equal to 1."]},
    }}


def test_the_first_error_route_binds_a_valid_order(client):
    response = post(client, "/body/validate/first-error", expected.raw("order.small.json"))

    assert response.status_code == 200
    assert response.json()["echo"] == expected.json("order.small.json")


def test_the_bind_routes_check_no_rule(client):
    response = post(client, "/body/bind/small", expected.raw("order.invalid.json"))

    assert response.status_code == 200
    assert response.json()["fields"] == 2


def test_the_bind_routes_still_check_types(client):
    response = post(client, "/body/bind/small", b'{"customerId":"first","status":"open","lines":[]}')

    assert response.status_code == 400
    assert response.json() == {"customerId": ["A valid integer is required."]}
