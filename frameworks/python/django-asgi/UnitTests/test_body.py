import pytest

import expected

JSON = "application/json"


# rb:test body.bind_small,body.bind_medium,body.validate_small,body.validate_medium
@pytest.mark.corpus("body.bind_small", "body.bind_medium", "body.validate_small", "body.validate_medium")
@pytest.mark.parametrize(("path", "file"), [
    ("/body/bind/small", "order.small.json"),
    ("/body/bind/medium", "order.medium.json"),
    ("/body/validate/small", "order.small.json"),
    ("/body/validate/medium", "order.medium.json"),
])
async def test_an_order_is_answered_with_its_leaves_its_length_and_itself(client, path, file):
    body = expected.raw(file)

    response = await client.post(path, body, content_type=JSON)

    order = expected.json(file)
    assert response.status_code == 200
    assert response.json() == {"fields": 2 + 2 * len(order["lines"]), "bytes": len(body), "echo": order}
# rb:end


# rb:test body.rejected_all
@pytest.mark.corpus("body.rejected_all")
async def test_the_form_refuses_order_invalid_naming_every_rule_it_breaks(client):
    response = await client.post("/body/validate/small", expected.raw("order.invalid.json"), content_type=JSON)

    assert response.status_code == 400
    assert response.json() == {
        "customerId": ["Ensure this value is greater than or equal to 1."],
        "status": ["This field is required."],
        "lines": ["This field is required."],
    }


# rb:test body.rejected_first
@pytest.mark.corpus("body.rejected_first")
async def test_the_first_error_route_stops_at_the_first_field(client):
    response = await client.post("/body/validate/first-error", expected.raw("order.invalid.json"), content_type=JSON)

    assert response.status_code == 400
    assert response.json() == {"customerId": ["Ensure this value is greater than or equal to 1."]}


async def test_the_first_error_route_answers_what_the_form_would_for_that_field(client):
    body = b'{"customerId":1,"status":"","lines":[{"productId":1,"qty":0}]}'

    first = (await client.post("/body/validate/first-error", body, content_type=JSON)).json()
    every = (await client.post("/body/validate/small", body, content_type=JSON)).json()

    assert first == {"status": every["status"]}
    assert list(every) == ["status", "lines"]


async def test_each_line_is_held_to_the_line_form(client):
    body = b'{"customerId":1,"status":"open","lines":[{"productId":1,"qty":0},{"productId":0,"qty":1}]}'

    response = await client.post("/body/validate/small", body, content_type=JSON)

    assert response.status_code == 400
    assert response.json() == {"lines": [
        "qty on line 0: Ensure this value is greater than or equal to 1.",
        "productId on line 1: Ensure this value is greater than or equal to 1.",
    ]}


async def test_the_first_error_route_binds_a_valid_order(client):
    response = await client.post("/body/validate/first-error", expected.raw("order.small.json"), content_type=JSON)

    assert response.status_code == 200
    assert response.json()["echo"] == expected.json("order.small.json")


async def test_the_bind_routes_check_no_rule(client):
    response = await client.post("/body/bind/small", expected.raw("order.invalid.json"), content_type=JSON)

    assert response.status_code == 200
    assert response.json()["fields"] == 2
