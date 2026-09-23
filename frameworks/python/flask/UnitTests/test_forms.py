import io

import pytest

import expected
from expected import RUN, SEARCH


# rb:test forms.urlencoded
@pytest.mark.corpus("forms.urlencoded")
def test_query_manys_eight_values_from_a_form_the_numbers_as_ints(client):
    response = client.post("/forms/urlencoded", data={name: str(RUN[name]) for name in SEARCH})

    assert response.json == expected.with_echo("items.small.json", {name: RUN[name] for name in SEARCH})


# rb:test forms.multipart
@pytest.mark.corpus("forms.multipart")
def test_the_file_is_read_to_its_end_and_the_fields_are_echoed(client):
    file = expected.raw("forms.file.txt")

    response = client.post("/forms/multipart", data={"tenant": RUN["tenant"], "requestId": RUN["requestId"],
                                                     "file": (io.BytesIO(file), "forms.file.txt", "text/plain")})

    assert response.status_code == 200
    assert response.json == {"file": {"name": "forms.file.txt", "bytes": len(file)},
                             "echo": {"tenant": RUN["tenant"], "requestId": RUN["requestId"]}}
