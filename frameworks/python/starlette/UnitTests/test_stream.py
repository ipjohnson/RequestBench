import json

import pytest

import expected


# rb:test stream.ndjson
@pytest.mark.corpus("stream.ndjson")
def test_each_row_of_items_medium_is_a_line_with_no_length(client):
    response = client.get("/stream/items")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/x-ndjson")
    assert "content-length" not in response.headers
    assert [json.loads(line) for line in response.text.splitlines()] == expected.json("items.medium.json")["items"]
