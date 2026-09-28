import os
import re
import time

import pytest
from django.core.cache import cache

import expected


@pytest.fixture(autouse=True)
def empty():
    """The suite's one store, emptied before each test."""
    cache.clear()


async def serial(client, path: str, **headers: str) -> str:
    """x-rb-serial, after checking it is the Unix time in milliseconds it was written at, this
    process's id and a count."""
    response = await client.get(path, headers={name.replace("_", "-"): value for name, value in headers.items()})
    value = response.headers["x-rb-serial"]
    form = re.fullmatch(r"(\d+)\|(\d+)-\d+", value)
    assert form, f"x-rb-serial {value} is not <time stamp>|<process id>-<count>"
    assert int(form[2]) == os.getpid()
    assert 0 <= time.time_ns() // 1_000_000 - int(form[1]) < 60_000
    return value


# rb:test cache.small,cache.medium,cache.large
@pytest.mark.corpus("cache.small", "cache.medium", "cache.large")
@pytest.mark.parametrize("size", ["small", "medium", "large"])
async def test_a_second_request_for_a_key_is_its_stored_answer(client, size):
    first = await client.get(f"/cache/{size}/k1")
    second = await client.get(f"/cache/{size}/k1")

    assert second.json() == expected.json(f"items.{size}.json")
    assert second.headers["x-rb-serial"] == first.headers["x-rb-serial"]
    assert await serial(client, f"/cache/{size}/k2") != first.headers["x-rb-serial"]
    assert second.headers["content-type"].startswith("application/json")


# rb:test cache.vary_one
@pytest.mark.corpus("cache.vary_one")
async def test_one_vary_header_keys_the_store(client):
    alpha = await serial(client, "/cache/vary/one/k1", x_rb_tenant="alpha")
    beta = await serial(client, "/cache/vary/one/k1", x_rb_tenant="beta")

    assert await serial(client, "/cache/vary/one/k1", x_rb_tenant="alpha") == alpha
    assert alpha != beta


# rb:test cache.vary_many
@pytest.mark.corpus("cache.vary_many")
async def test_each_of_three_vary_headers_keys_the_store(client):
    web_eu_alpha = {"x_rb_channel": "web", "x_rb_region": "eu", "x_rb_tenant": "alpha"}

    first = await serial(client, "/cache/vary/many/k1", **web_eu_alpha)

    assert await serial(client, "/cache/vary/many/k1", **web_eu_alpha) == first
    assert await serial(client, "/cache/vary/many/k1", **(web_eu_alpha | {"x_rb_tenant": "beta"})) != first
    assert await serial(client, "/cache/vary/many/k1", **(web_eu_alpha | {"x_rb_region": "us"})) != first


async def test_the_answer_says_what_it_varies_on(client):
    response = await client.get("/cache/vary/many/k1")

    assert response.headers["vary"] == "x-rb-channel, x-rb-region, x-rb-tenant"


async def test_every_key_the_corpus_sends_fits_the_store(client):
    web_eu_alpha = {"x_rb_channel": "web", "x_rb_region": "eu", "x_rb_tenant": "alpha"}
    first = await serial(client, "/cache/vary/many/k1", **web_eu_alpha)
    small = await serial(client, "/cache/small/k1")
    for key in ("k1", "k2", "k3", "k4"):
        for channel in ("web", "app"):
            for region in ("eu", "us"):
                for tenant in ("alpha", "beta"):
                    await serial(client, f"/cache/vary/many/{key}", x_rb_channel=channel, x_rb_region=region, x_rb_tenant=tenant)
        for tenant in ("alpha", "beta"):
            await serial(client, f"/cache/vary/one/{key}", x_rb_tenant=tenant)
        for size in ("small", "medium", "large"):
            await serial(client, f"/cache/{size}/{key}")

    assert await serial(client, "/cache/vary/many/k1", **web_eu_alpha) == first
    assert await serial(client, "/cache/small/k1") == small


async def test_a_route_outside_the_family_is_never_stored(client):
    assert await serial(client, "/compressed/small") != await serial(client, "/compressed/small")
