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
def test_the_middleware_answers_a_preflight_before_any_view(client):
    response = preflight(client, "/cors/small", CORS["origin"])

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == CORS["origin"]
    assert response.headers["access-control-allow-headers"] == CORS["header"]
    assert response.headers["access-control-max-age"] == str(CORS["maxAgeSeconds"])
    assert "x-rb-serial" not in response.headers


# rb:test cors.disallowed
@pytest.mark.corpus("cors.disallowed")
def test_a_preflight_from_another_origin_is_not_allowed(client):
    response = preflight(client, "/cors/small", "https://elsewhere.example.net")

    assert "access-control-allow-origin" not in response.headers


# rb:test cors.request,cors.vary
@pytest.mark.corpus("cors.request", "cors.vary")
def test_the_request_reaches_the_view_and_varies_on_origin(client):
    response = client.get("/cors/small", headers={"origin": CORS["origin"], CORS["header"]: "qwertyuiopas"})

    assert response.json() == expected.json("items.small.json")
    assert response.headers["access-control-allow-origin"] == CORS["origin"]
    assert response.headers["vary"] == "origin"
    assert "x-rb-serial" in response.headers


# rb:test cors.scoped
@pytest.mark.corpus("cors.scoped")
def test_a_path_the_regex_does_not_match_gets_no_policy(client):
    response = client.get("/json/small", headers={"origin": CORS["origin"]})

    assert "access-control-allow-origin" not in response.headers


def test_drf_answers_a_preflight_outside_the_regex_with_the_views_description(client):
    response = preflight(client, "/json/small", CORS["origin"])

    assert response.status_code == 200
    assert "access-control-allow-origin" not in response.headers
    assert response.json()["renders"] == ["application/json"]
