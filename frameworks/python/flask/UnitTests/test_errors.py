import pytest

# errors: every refusal is Werkzeug's own HTML page, written by Flask's default error handling.
# Nothing here reshapes any of them.


# rb:test errors.unmatched
@pytest.mark.corpus("errors.unmatched")
def test_a_path_no_route_matches_is_the_routers_404(client):
    response = client.get("/errors/unmatched")

    assert response.status_code == 404
    assert "<title>404 Not Found</title>" in response.text


# rb:test errors.not_found
@pytest.mark.corpus("errors.not_found")
def test_an_id_with_no_row_is_the_views_404(client):
    response = client.get("/items/999999")

    assert response.status_code == 404
    assert "<title>404 Not Found</title>" in response.text


# rb:test errors.wrong_method
@pytest.mark.corpus("errors.wrong_method")
def test_a_method_the_path_has_no_route_for_is_405(client):
    response = client.post("/items/17")

    assert response.status_code == 405
    assert "<title>405 Method Not Allowed</title>" in response.text
    assert set(response.headers["allow"].split(", ")) == {"GET", "HEAD", "OPTIONS", "PUT", "PATCH", "DELETE"}


# rb:test errors.malformed
@pytest.mark.corpus("errors.malformed")
def test_a_body_that_is_not_json_is_flasks_400(client):
    response = client.post("/body/validate/small", data=b'{"customerId": 1, "lines": [', content_type="application/json")

    assert response.status_code == 400
    assert "<title>400 Bad Request</title>" in response.text
