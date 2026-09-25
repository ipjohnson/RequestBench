from urllib.parse import urlencode

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

import expected
from expected import RUN, SEARCH


# rb:test forms.urlencoded
@pytest.mark.corpus("forms.urlencoded")
def test_query_manys_eight_values_from_a_form_the_numbers_as_ints(client):
    body = urlencode({name: str(RUN[name]) for name in SEARCH})

    response = client.post("/forms/urlencoded", body, content_type="application/x-www-form-urlencoded")

    assert response.json() == expected.with_echo("items.small.json", {name: RUN[name] for name in SEARCH})


# rb:test forms.multipart
@pytest.mark.corpus("forms.multipart")
def test_the_file_is_read_to_its_end_and_the_fields_are_echoed(client):
    file = expected.raw("forms.file.txt")

    response = client.post("/forms/multipart", {
        "tenant": RUN["tenant"],
        "requestId": RUN["requestId"],
        "file": SimpleUploadedFile("forms.file.txt", file, content_type="text/plain"),
    }, format="multipart")

    assert response.status_code == 200
    assert response.json() == {"file": {"name": "forms.file.txt", "bytes": len(file)},
                               "echo": {"tenant": RUN["tenant"], "requestId": RUN["requestId"]}}
