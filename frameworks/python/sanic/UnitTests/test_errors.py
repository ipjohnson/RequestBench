import pytest

# errors: every refusal is Sanic's own, rendered by its error handler. A route whose handler answers
# with json() has its errors answered as JSON, and a path with no route has them answered as text.
# Nothing here reshapes any of them.


# rb:test errors.unmatched
@pytest.mark.corpus("errors.unmatched")
def test_a_path_no_route_matches_is_the_routers_404(client):
    response = client.get("/errors/unmatched")

    assert response.status_code == 404
    assert response.headers["content-type"].startswith("text/plain")
    assert "Requested URL /errors/unmatched not found" in response.text


# rb:test errors.not_found
@pytest.mark.corpus("errors.not_found")
def test_an_id_with_no_row_is_the_handlers_404(client):
    response = client.get("/items/999999")

    assert response.status_code == 404
    assert response.json == {"description": "Not Found", "status": 404, "message": "Not Found"}


# rb:test errors.wrong_method
@pytest.mark.corpus("errors.wrong_method")
def test_a_method_the_path_has_no_route_for_is_405(client):
    response = client.post("/items/17")

    assert response.status_code == 405
    assert "Method POST not allowed for URL /items/17" in response.text


def test_the_405_on_a_path_with_a_capture_names_no_allowed_method(client):
    assert "allow" not in client.post("/items/17").headers
    assert set(client.post("/json/small").headers["allow"].split(", ")) == {"GET", "HEAD", "OPTIONS"}


# rb:test errors.malformed
@pytest.mark.corpus("errors.malformed")
def test_a_body_that_is_not_json_is_sanics_400(client):
    response = client.post("/body/validate/small", content=b'{"customerId": 1, "lines": [', headers={"content-type": "application/json"})

    assert response.status_code == 400
    assert response.json == {"description": "Bad Request", "status": 400, "message": "Failed when parsing body as json"}
