import pytest


# rb:test baseline.plaintext
@pytest.mark.corpus("baseline.plaintext")
def test_the_string_goes_out_through_the_plain_text_renderer(client):
    response = client.get("/plaintext")

    assert response.status_code == 200
    assert response.content == b"Hello, World!"
    assert response.headers["content-type"] == "text/plain; charset=utf-8"
