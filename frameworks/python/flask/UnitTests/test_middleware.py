import pytest

import expected


# rb:test middleware.none,middleware.four,middleware.sixteen
@pytest.mark.corpus("middleware.none", "middleware.four", "middleware.sixteen")
@pytest.mark.parametrize("layers", ["none", "four", "sixteen"])
def test_the_hooks_in_front_of_the_view_leave_the_answer_alone(client, layers):
    response = client.get(f"/middleware/{layers}")

    assert response.json == expected.json("items.small.json")


@pytest.mark.parametrize(("layers", "hooks"), [("none", 0), ("four", 4), ("sixteen", 16)])
def test_each_blueprint_holds_as_many_hooks_as_its_name_says(client, layers, hooks):
    assert len(client.application.before_request_funcs.get(f"middleware.{layers}", [])) == hooks
