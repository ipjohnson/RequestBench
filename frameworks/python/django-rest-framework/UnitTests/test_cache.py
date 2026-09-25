import pytest
from django.core.cache import cache

import expected


@pytest.fixture(autouse=True)
def empty():
    """The suite's one store, emptied before each test."""
    cache.clear()


def serial(client, path: str, **headers: str) -> str:
    return client.get(path, headers={name.replace("_", "-"): value for name, value in headers.items()}).headers["x-rb-serial"]


# rb:test cache.small,cache.medium,cache.large
@pytest.mark.corpus("cache.small", "cache.medium", "cache.large")
@pytest.mark.parametrize("size", ["small", "medium", "large"])
def test_a_second_request_is_the_stored_answer(client, size):
    first = client.get(f"/cache/{size}")
    second = client.get(f"/cache/{size}")

    assert second.json() == expected.json(f"items.{size}.json")
    assert second.headers["x-rb-serial"] == first.headers["x-rb-serial"]
    assert second.headers["content-type"] == "application/json"


# rb:test cache.vary_one
@pytest.mark.corpus("cache.vary_one")
def test_one_vary_header_keys_the_store(client):
    alpha = serial(client, "/cache/vary/one", x_rb_tenant="alpha")
    beta = serial(client, "/cache/vary/one", x_rb_tenant="beta")

    assert serial(client, "/cache/vary/one", x_rb_tenant="alpha") == alpha
    assert alpha != beta


# rb:test cache.vary_many
@pytest.mark.corpus("cache.vary_many")
def test_each_of_three_vary_headers_keys_the_store(client):
    web_eu_alpha = {"x_rb_channel": "web", "x_rb_region": "eu", "x_rb_tenant": "alpha"}

    first = serial(client, "/cache/vary/many", **web_eu_alpha)

    assert serial(client, "/cache/vary/many", **web_eu_alpha) == first
    assert serial(client, "/cache/vary/many", **(web_eu_alpha | {"x_rb_tenant": "beta"})) != first
    assert serial(client, "/cache/vary/many", **(web_eu_alpha | {"x_rb_region": "us"})) != first


def test_the_answer_says_what_it_varies_on(client):
    assert client.get("/cache/vary/many").headers["vary"] == "x-rb-channel, x-rb-region, x-rb-tenant"


def test_every_combination_the_corpus_sends_fits_the_store(client):
    for channel in ("web", "app"):
        for region in ("eu", "us"):
            for tenant in ("alpha", "beta"):
                serial(client, "/cache/vary/many", x_rb_channel=channel, x_rb_region=region, x_rb_tenant=tenant)
    for tenant in ("alpha", "beta"):
        serial(client, "/cache/vary/one", x_rb_tenant=tenant)
    for size in ("small", "medium", "large"):
        client.get(f"/cache/{size}")

    assert serial(client, "/cache/vary/many", x_rb_channel="web", x_rb_region="eu", x_rb_tenant="alpha") == \
        serial(client, "/cache/vary/many", x_rb_channel="web", x_rb_region="eu", x_rb_tenant="alpha")
    assert serial(client, "/cache/small") == serial(client, "/cache/small")


def test_a_route_outside_the_family_is_never_stored(client):
    assert serial(client, "/compressed/small") != serial(client, "/compressed/small")
