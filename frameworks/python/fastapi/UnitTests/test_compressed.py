import pytest

import expected


def get(client, size: str, encoding: str):
    return client.get(f"/compressed/{size}", headers={"accept-encoding": encoding, "cache-control": "no-cache"})


# rb:test compressed.gzip_large
@pytest.mark.corpus("compressed.gzip_large")
def test_a_large_body_is_gzipped_when_asked(client):
    response = get(client, "large", "gzip")

    assert response.headers["content-encoding"] == "gzip"
    assert response.json() == expected.json("items.large.json")


# rb:test compressed.gzip_small
@pytest.mark.corpus("compressed.gzip_small")
def test_a_body_under_the_minimum_goes_out_as_it_is(client):
    response = get(client, "small", "gzip")

    assert "content-encoding" not in response.headers
    assert response.json() == expected.json("items.small.json")


# rb:test compressed.identity_small,compressed.identity_large
@pytest.mark.corpus("compressed.identity_small", "compressed.identity_large")
@pytest.mark.parametrize("size", ["small", "large"])
def test_identity_is_answered_as_it_is_and_the_handler_runs_every_time(client, size):
    first = get(client, size, "identity")
    second = get(client, size, "identity")

    assert "content-encoding" not in second.headers
    assert second.json() == expected.json(f"items.{size}.json")
    assert int(second.headers["x-rb-serial"]) > int(first.headers["x-rb-serial"])


def test_a_route_outside_the_family_is_not_compressed(client):
    assert "content-encoding" not in client.get("/json/large", headers={"accept-encoding": "gzip"}).headers
