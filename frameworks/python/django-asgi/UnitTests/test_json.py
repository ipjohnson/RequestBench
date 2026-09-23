import pytest

import expected


# rb:test json.small,json.medium,json.large
@pytest.mark.corpus("json.small", "json.medium", "json.large")
@pytest.mark.parametrize("size", ["small", "medium", "large"])
async def test_the_payload_is_serialised_by_jsonresponse(client, size):
    response = await client.get(f"/json/{size}")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    assert response.json() == expected.json(f"items.{size}.json")


async def test_commonmiddleware_writes_the_length(client):
    response = await client.get("/json/small")

    assert response.headers["content-length"] == str(len(response.content))


async def test_a_method_the_route_does_not_name_is_405(client):
    response = await client.post("/json/small")

    assert response.status_code == 405
    assert response.headers["allow"] == "GET"
