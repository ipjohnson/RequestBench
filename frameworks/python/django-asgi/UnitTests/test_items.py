import pytest

import expected

JSON = "application/json"


# rb:test items.read
@pytest.mark.corpus("items.read")
async def test_a_row_is_read_by_the_id_in_the_path(client):
    response = await client.get("/items/17")

    assert response.status_code == 200
    assert response.json() == expected.row(17)


# rb:test items.head
@pytest.mark.corpus("items.head")
async def test_head_is_answered_by_get_with_no_body(client):
    response = await client.head("/items/17")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    assert response.content == b""


# rb:test items.create
@pytest.mark.corpus("items.create")
async def test_a_created_item_is_the_row_after_the_last(client):
    response = await client.post("/items", expected.raw("items.new.json"), content_type=JSON)

    assert response.status_code == 201
    assert response.headers["location"] == "/items/1426"
    assert response.json() == {"id": 1426, **expected.json("items.new.json")}


# rb:test items.replace
@pytest.mark.corpus("items.replace")
async def test_a_replaced_item_takes_the_id_in_the_path(client):
    response = await client.put("/items/17", expected.raw("items.new.json"), content_type=JSON)

    assert response.json() == {"id": 17, **expected.json("items.new.json")}


# rb:test items.update
@pytest.mark.corpus("items.update")
async def test_a_patch_is_merged_onto_the_row(client):
    response = await client.patch("/items/17", expected.raw("items.patch.json"), content_type=JSON)

    assert response.json() == expected.row(17) | expected.json("items.patch.json")


# rb:test items.delete
@pytest.mark.corpus("items.delete")
async def test_a_delete_is_answered_204_with_no_body(client):
    response = await client.delete("/items/17")

    assert response.status_code == 204
    assert response.content == b""


async def test_a_patch_that_names_one_field_changes_that_field_alone(client):
    response = await client.patch("/items/17", b'{"inStock": false}', content_type=JSON)

    assert response.json() == expected.row(17) | {"inStock": False}


async def test_a_patch_or_a_delete_of_a_missing_row_is_404(client):
    assert (await client.patch("/items/999999", expected.raw("items.patch.json"), content_type=JSON)).status_code == 404
    assert (await client.delete("/items/999999")).status_code == 404
