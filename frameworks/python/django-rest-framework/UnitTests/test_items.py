import pytest

import expected

JSON = "application/json"


# rb:test items.read
@pytest.mark.corpus("items.read")
def test_a_row_is_read_by_the_id_in_the_path(client):
    response = client.get("/items/17")

    assert response.status_code == 200
    assert response.json() == expected.row(17)


# rb:test items.head
@pytest.mark.corpus("items.head")
def test_head_is_answered_by_retrieve(client):
    response = client.head("/items/17")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    assert response.content == b""


# rb:test items.create
@pytest.mark.corpus("items.create")
def test_a_created_item_is_the_row_after_the_last(client):
    response = client.post("/items", expected.raw("items.new.json"), content_type=JSON)

    assert response.status_code == 201
    assert response.headers["location"] == "http://testserver/items/1426"
    assert response.json() == {"id": 1426, **expected.json("items.new.json")}


# rb:test items.replace
@pytest.mark.corpus("items.replace")
def test_a_replaced_item_takes_the_id_in_the_path(client):
    response = client.put("/items/17", expected.raw("items.new.json"), content_type=JSON)

    assert response.json() == {"id": 17, **expected.json("items.new.json")}


# rb:test items.update
@pytest.mark.corpus("items.update")
def test_a_patch_is_merged_onto_the_row(client):
    response = client.patch("/items/17", expected.raw("items.patch.json"), content_type=JSON)

    assert response.json() == expected.row(17) | expected.json("items.patch.json")


# rb:test items.delete
@pytest.mark.corpus("items.delete")
def test_a_delete_is_answered_204_with_no_body(client):
    response = client.delete("/items/17")

    assert response.status_code == 204
    assert response.content == b""
    assert "content-type" not in response.headers


def test_a_patch_that_names_one_field_changes_that_field_alone(client):
    response = client.patch("/items/17", b'{"inStock": false}', content_type=JSON)

    assert response.json() == expected.row(17) | {"inStock": False}


def test_a_create_missing_a_field_is_the_serializers_400(client):
    response = client.post("/items", b'{"name":"a","category":"b","priceCents":1}', content_type=JSON)

    assert response.status_code == 400
    assert response.json() == {"inStock": ["This field is required."]}


def test_a_patch_or_a_delete_of_a_missing_row_is_404(client):
    assert client.patch("/items/999999", expected.raw("items.patch.json"), content_type=JSON).status_code == 404
    assert client.delete("/items/999999").status_code == 404
