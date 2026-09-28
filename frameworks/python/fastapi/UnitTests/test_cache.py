import os
import re
import time

import pytest

import expected


def serial(client, path: str, **headers: str) -> str:
    """x-rb-serial, after checking it is the Unix time in milliseconds it was written at, this
    process's id and a count."""
    value = client.get(path, headers={name.replace("_", "-"): value for name, value in headers.items()}).headers["x-rb-serial"]
    form = re.fullmatch(r"(\d+)\|(\d+)-\d+", value)
    assert form, f"x-rb-serial {value} is not <time stamp>|<process id>-<count>"
    assert int(form[2]) == os.getpid()
    assert 0 <= time.time_ns() // 1_000_000 - int(form[1]) < 60_000
    return value


# rb:test cache.small,cache.medium,cache.large
@pytest.mark.corpus("cache.small", "cache.medium", "cache.large")
@pytest.mark.parametrize("size", ["small", "medium", "large"])
def test_a_second_request_for_a_key_is_its_stored_answer(client, size):
    first = client.get(f"/cache/{size}/k1")
    second = client.get(f"/cache/{size}/k1")

    assert second.json() == expected.json(f"items.{size}.json")
    assert second.headers["x-rb-serial"] == first.headers["x-rb-serial"]
    assert serial(client, f"/cache/{size}/k2") != first.headers["x-rb-serial"]
    assert second.headers["content-type"].startswith("application/json")


# rb:test cache.vary_one
@pytest.mark.corpus("cache.vary_one")
def test_one_vary_header_keys_the_store(client):
    alpha = serial(client, "/cache/vary/one/k1", x_rb_tenant="alpha")
    beta = serial(client, "/cache/vary/one/k1", x_rb_tenant="beta")

    assert serial(client, "/cache/vary/one/k1", x_rb_tenant="alpha") == alpha
    assert alpha != beta


# rb:test cache.vary_many
@pytest.mark.corpus("cache.vary_many")
def test_each_of_three_vary_headers_keys_the_store(client):
    web_eu_alpha = {"x_rb_channel": "web", "x_rb_region": "eu", "x_rb_tenant": "alpha"}

    first = serial(client, "/cache/vary/many/k1", **web_eu_alpha)

    assert serial(client, "/cache/vary/many/k1", **web_eu_alpha) == first
    assert serial(client, "/cache/vary/many/k1", **(web_eu_alpha | {"x_rb_tenant": "beta"})) != first
    assert serial(client, "/cache/vary/many/k1", **(web_eu_alpha | {"x_rb_region": "us"})) != first


def test_the_answer_says_what_it_varies_on(client):
    assert client.get("/cache/vary/many/k1").headers["vary"] == "x-rb-channel, x-rb-region, x-rb-tenant"


def test_a_route_outside_the_family_is_never_stored(client):
    assert serial(client, "/compressed/small") != serial(client, "/compressed/small")
