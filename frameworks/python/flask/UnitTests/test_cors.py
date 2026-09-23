import pytest

import expected

CORS = expected.json("settings.json")["cors"]


def preflight(client, path: str, origin: str):
    return client.options(path, headers={
        "origin": origin,
        "access-control-request-method": CORS["method"],
        "access-control-request-headers": CORS["header"],
    })


# rb:test cors.preflight
@pytest.mark.corpus("cors.preflight")
def test_flask_answers_the_preflight_and_flask_cors_adds_the_policy(client):
    response = preflight(client, "/cors/small", CORS["origin"])

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == CORS["origin"]
    assert CORS["header"] in response.headers["access-control-allow-headers"].split(", ")
    assert response.headers["access-control-max-age"] == str(CORS["maxAgeSeconds"])
    assert "x-rb-serial" not in response.headers


# rb:test cors.disallowed
@pytest.mark.corpus("cors.disallowed")
def test_a_preflight_from_another_origin_is_not_allowed(client):
    response = preflight(client, "/cors/small", "https://elsewhere.example.net")

    assert "access-control-allow-origin" not in response.headers


# rb:test cors.request
@pytest.mark.corpus("cors.request")
def test_the_request_reaches_the_view(client):
    response = client.get("/cors/small", headers={"origin": CORS["origin"], CORS["header"]: "qwertyuiopas"})

    assert response.json == expected.json("items.small.json")
    assert response.headers["access-control-allow-origin"] == CORS["origin"]
    assert "x-rb-serial" in response.headers


# rb.json skips cors.vary for this. When Flask-CORS writes the header for one origin, this fails and
# the skip can go.
# rb:test cors.vary
@pytest.mark.corpus("cors.vary")
def test_one_allowed_origin_writes_no_vary(client):
    response = client.get("/cors/small", headers={"origin": CORS["origin"]})

    assert "vary" not in response.headers


# rb:test cors.scoped
@pytest.mark.corpus("cors.scoped")
def test_a_route_outside_cors_gets_no_policy(client):
    response = client.get("/json/small", headers={"origin": CORS["origin"]})

    assert "access-control-allow-origin" not in response.headers
    assert "access-control-allow-origin" not in preflight(client, "/json/small", CORS["origin"]).headers
