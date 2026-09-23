import json

import pytest

import expected


# rb:test stream.ndjson
@pytest.mark.corpus("stream.ndjson")
async def test_each_row_of_items_medium_is_a_line_with_no_length(client):
    response = await client.get("/stream/items")

    body = b"".join([chunk async for chunk in response.streaming_content])
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/x-ndjson")
    assert "content-length" not in response.headers
    assert [json.loads(line) for line in body.splitlines()] == expected.json("items.medium.json")["items"]
