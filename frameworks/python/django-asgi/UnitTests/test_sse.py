import json

import pytest

import expected


# rb:test sse.medium
@pytest.mark.corpus("sse.medium")
async def test_each_row_of_items_medium_is_the_data_of_one_event(client):
    response = await client.get("/sse/medium", headers={"accept": "text/event-stream"})

    body = b"".join([chunk async for chunk in response.streaming_content]).decode()
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert "content-length" not in response.headers
    events = [event for event in body.split("\n\n") if event]
    assert [json.loads(event.removeprefix("data: ")) for event in events] == expected.json("items.medium.json")["items"]
