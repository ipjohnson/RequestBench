from sanic import Blueprint
from sanic.response import json
from sanic_ext import openapi, validate

from answers import echoed
from documented import answers, refuses
from models import Camel
from payloads import Payloads
from routes.query import EchoedSearch, Search


@openapi.component
class Upload(Camel):
    """What forms.multipart posts, as the document states it."""

    tenant: str
    request_id: str
    file: bytes


class UploadedFile(Camel):
    name: str
    bytes: int


class UploadEcho(Camel):
    tenant: str
    request_id: str


class Uploaded(Camel):
    """What forms.multipart answers: the file's name and size, and the two fields beside it."""

    file: UploadedFile
    echo: UploadEcho


def blueprint(p: Payloads) -> Blueprint:
    """forms: the same eight values query.many reads, from a urlencoded body, and an upload. Sanic
    parses both bodies itself, and sanic-ext's @validate binds the urlencoded one to the query's
    model."""
    routes = Blueprint("forms")

    @routes.post("/forms/urlencoded")
    @answers(EchoedSearch, "items.small, with the eight values")
    @refuses(400, "sanic-ext's refusal of a value the model cannot bind")
    @validate(form=Search)
    async def urlencoded(request, body: Search):
        """Binds query.many's eight values from a form.

        openapi:
        ---
        requestBody: {required: true, content: {application/x-www-form-urlencoded: {schema: {$ref: "#/components/schemas/Search"}}}}
        """
        return json(echoed(p.small, body.model_dump()))

    # Sanic has read the upload to its end before the handler runs, so its size is known here.
    @routes.post("/forms/multipart")
    @answers(Uploaded, "The file's name and size, and the two fields")
    async def multipart(request):
        """Reads the upload and the two fields beside it.

        openapi:
        ---
        requestBody: {required: true, content: {multipart/form-data: {schema: {$ref: "#/components/schemas/Upload"}}}}
        """
        file = request.files.get("file")
        return json({"file": {"name": file.name, "bytes": len(file.body)},
                     "echo": {"tenant": request.form.get("tenant"), "requestId": request.form.get("requestId")}})

    return routes
