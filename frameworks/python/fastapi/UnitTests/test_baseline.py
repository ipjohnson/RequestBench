import pytest


# rb:test baseline.plaintext
@pytest.mark.corpus("baseline.plaintext")
def test_the_string_goes_out_as_text(client):
    response = client.get("/plaintext")

    assert response.status_code == 200
    assert response.text == "Hello, World!"
    assert response.headers["content-type"].startswith("text/plain")
