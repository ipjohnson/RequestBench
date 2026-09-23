import pytest

# errors: every refusal is Litestar's own, written as {"status_code": ..., "detail": ...}. Nothing
# here reshapes any of them.


# rb:test errors.unmatched
@pytest.mark.corpus("errors.unmatched")
def test_a_path_no_route_matches_is_the_routers_404(client):
    response = client.get("/errors/unmatched")

    assert response.status_code == 404
    assert response.json() == {"status_code": 404, "detail": "Not Found"}


# rb:test errors.not_found
@pytest.mark.corpus("errors.not_found")
def test_an_id_with_no_row_is_the_handlers_404(client):
    response = client.get("/items/999999")

    assert response.status_code == 404
    assert response.json() == {"status_code": 404, "detail": "Not Found"}


# rb:test errors.wrong_method
@pytest.mark.corpus("errors.wrong_method")
def test_a_method_the_path_has_no_handler_for_is_405(client):
    response = client.post("/items/17")

    assert response.status_code == 405
    assert response.json() == {"status_code": 405, "detail": "Method Not Allowed"}
    assert set(response.headers["allow"].split(", ")) == {"GET", "HEAD", "PUT", "PATCH", "DELETE", "OPTIONS"}


# rb:test errors.malformed
@pytest.mark.corpus("errors.malformed")
def test_a_body_that_is_not_json_is_litestars_400(client):
    response = client.post("/body/validate/small", content=b'{"customerId": 1, "lines": [', headers={"content-type": "application/json"})

    assert response.status_code == 400
    assert response.json() == {"status_code": 400, "detail": "Input data was truncated"}
