import pytest

import expected

ORIGIN = "https://shop.example.com"


def preflight(client, path: str, origin: str):
    return client.options(path, headers={
        "origin": origin,
        "access-control-request-method": "GET",
        "access-control-request-headers": "x-rb-tenant",
    })


# rb:test cors.preflight
@pytest.mark.corpus("cors.preflight")
def test_flask_answers_the_preflight_and_flask_cors_adds_the_policy(client):
    response = preflight(client, "/cors/small", ORIGIN)

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == ORIGIN
    assert "x-rb-tenant" in response.headers["access-control-allow-headers"].split(", ")
    assert response.headers["access-control-max-age"] == "600"
    assert "x-rb-serial" not in response.headers


# rb:test cors.disallowed
@pytest.mark.corpus("cors.disallowed")
def test_a_preflight_from_another_origin_is_not_allowed(client):
    response = preflight(client, "/cors/small", "https://elsewhere.example.net")

    assert "access-control-allow-origin" not in response.headers


# rb:test cors.request
@pytest.mark.corpus("cors.request")
def test_the_request_reaches_the_view(client):
    response = client.get("/cors/small", headers={"origin": ORIGIN, "x-rb-tenant": "qwertyuiopas"})

    assert response.json == expected.json("items.small.json")
    assert response.headers["access-control-allow-origin"] == ORIGIN
    assert "x-rb-serial" in response.headers


# rb.json skips cors.vary for this. When Flask-CORS writes the header for one origin, this fails and
# the skip can go.
# rb:test cors.vary
@pytest.mark.corpus("cors.vary")
def test_one_allowed_origin_writes_no_vary(client):
    response = client.get("/cors/small", headers={"origin": ORIGIN})

    assert "vary" not in response.headers


# rb:test cors.scoped
@pytest.mark.corpus("cors.scoped")
def test_a_route_outside_cors_gets_no_policy(client):
    response = client.get("/json/small", headers={"origin": ORIGIN})

    assert "access-control-allow-origin" not in response.headers
    assert "access-control-allow-origin" not in preflight(client, "/json/small", ORIGIN).headers
