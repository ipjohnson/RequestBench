import pytest

# errors: DRF answers inside its views alone, so a path no pattern matches is Django's own HTML 404
# page. Every other refusal is DRF's JSON: NotFound's 404, MethodNotAllowed's 405 and ParseError's
# 400. Nothing here reshapes any of them.


# rb:test errors.unmatched
@pytest.mark.corpus("errors.unmatched")
def test_a_path_no_pattern_matches_is_djangos_404_page(client):
    response = client.get("/errors/unmatched")

    assert response.status_code == 404
    assert response.headers["content-type"].startswith("text/html")
    assert b"<h1>Not Found</h1>" in response.content


# rb:test errors.not_found
@pytest.mark.corpus("errors.not_found")
def test_an_id_with_no_row_is_drfs_404(client):
    response = client.get("/items/999999")

    assert response.status_code == 404
    assert response.json() == {"detail": "Not found."}


# rb:test errors.wrong_method
@pytest.mark.corpus("errors.wrong_method")
def test_a_method_the_viewset_has_no_action_for_is_405(client):
    response = client.post("/items/17")

    assert response.status_code == 405
    assert response.json() == {"detail": 'Method "POST" not allowed.'}
    assert response.headers["allow"] == "GET, PUT, PATCH, DELETE, HEAD, OPTIONS"


# rb:test errors.malformed
@pytest.mark.corpus("errors.malformed")
def test_a_body_that_is_not_json_is_the_parsers_400(client):
    response = client.post("/body/validate/small", b'{"customerId": 1, "lines": [', content_type="application/json")

    assert response.status_code == 400
    assert response.json()["detail"].startswith("JSON parse error - ")


def test_a_body_that_is_json_but_no_object_is_the_serializers_400(client):
    response = client.post("/body/validate/small", b"[1, 2]", content_type="application/json")

    assert response.status_code == 400
    assert response.json() == {"non_field_errors": ["Invalid data. Expected a dictionary, but got list."]}
