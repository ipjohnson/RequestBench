import pytest


# rb:test baseline.plaintext
@pytest.mark.corpus("baseline.plaintext")
async def test_the_string_goes_out_as_text(client):
    response = await client.get("/plaintext")

    assert response.status_code == 200
    assert response.content == b"Hello, World!"
    assert response.headers["content-type"].startswith("text/plain")
