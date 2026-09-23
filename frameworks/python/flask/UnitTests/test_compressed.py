import gzip
import json

import pytest

import expected


def get(client, size: str, encoding: str):
    return client.get(f"/compressed/{size}", headers={"accept-encoding": encoding, "cache-control": "no-cache"})


# rb:test compressed.gzip_large
@pytest.mark.corpus("compressed.gzip_large")
def test_a_large_body_is_gzipped_at_level_1_when_asked(client):
    response = get(client, "large", "gzip")

    assert response.headers["content-encoding"] == "gzip"
    assert json.loads(gzip.decompress(response.data)) == expected.json("items.large.json")
    # The header's XFL byte is 4 for gzip's fastest level, 2 for its best and 0 for any other.
    assert response.data[8] == 4


# rb:test compressed.gzip_small
@pytest.mark.corpus("compressed.gzip_small")
def test_a_body_under_the_minimum_goes_out_as_it_is(client):
    response = get(client, "small", "gzip")

    assert "content-encoding" not in response.headers
    assert response.json == expected.json("items.small.json")


# rb:test compressed.identity_small,compressed.identity_large
@pytest.mark.corpus("compressed.identity_small", "compressed.identity_large")
@pytest.mark.parametrize("size", ["small", "large"])
def test_identity_is_answered_as_it_is_and_the_view_runs_every_time(client, size):
    first = get(client, size, "identity")
    second = get(client, size, "identity")

    assert "content-encoding" not in second.headers
    assert second.json == expected.json(f"items.{size}.json")
    assert int(second.headers["x-rb-serial"]) > int(first.headers["x-rb-serial"])


def test_a_route_outside_the_family_is_not_compressed(client):
    assert "content-encoding" not in client.get("/json/large", headers={"accept-encoding": "gzip"}).headers
