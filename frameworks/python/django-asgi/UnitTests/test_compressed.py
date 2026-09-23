import gzip
import json

import pytest

import expected


async def get(client, size: str, encoding: str):
    return await client.get(f"/compressed/{size}", headers={"accept-encoding": encoding, "cache-control": "no-cache"})


# rb:test compressed.gzip_large
@pytest.mark.corpus("compressed.gzip_large")
async def test_a_large_body_is_gzipped_when_asked(client):
    response = await get(client, "large", "gzip")

    assert response.headers["content-encoding"] == "gzip"
    assert response.headers["content-length"] == str(len(response.content))
    assert json.loads(gzip.decompress(response.content)) == expected.json("items.large.json")


# rb:test compressed.gzip_small
@pytest.mark.corpus("compressed.gzip_small")
async def test_a_body_under_200_bytes_goes_out_as_it_is(client):
    response = await get(client, "small", "gzip")

    assert "content-encoding" not in response.headers
    assert response.json() == expected.json("items.small.json")


# rb:test compressed.identity_small,compressed.identity_large
@pytest.mark.corpus("compressed.identity_small", "compressed.identity_large")
@pytest.mark.parametrize("size", ["small", "large"])
async def test_identity_is_answered_as_it_is_and_the_view_runs_every_time(client, size):
    first = await get(client, size, "identity")
    second = await get(client, size, "identity")

    assert "content-encoding" not in second.headers
    assert second.json() == expected.json(f"items.{size}.json")
    assert int(second.headers["x-rb-serial"]) > int(first.headers["x-rb-serial"])


async def test_a_route_outside_the_family_is_not_compressed(client):
    response = await client.get("/json/large", headers={"accept-encoding": "gzip"})

    assert "content-encoding" not in response.headers
