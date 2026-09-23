from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import BaseRoute, Route

from payloads import Payloads
from routes.query import Search
from validation import spec


def routes(p: Payloads) -> list[BaseRoute]:
    """forms: the same eight values query.many reads, from a urlencoded body, and an upload. Starlette
    parses both through python-multipart."""

    # rb:handler forms.urlencoded
    @spec.validate(form=Search)
    async def urlencoded(request: Request) -> JSONResponse:
        """
        requestBody: {required: true, content: {application/x-www-form-urlencoded: {schema: {$ref: "#/components/schemas/Search"}}}}
        responses:
          200: {description: items.small and the eight values, content: {application/json: {schema: {$ref: "#/components/schemas/EchoedSearch"}}}}
          422: {$ref: "#/components/responses/Refused"}
        """
        return JSONResponse({**p.small, "echo": request.context.form.model_dump()})

    # The upload is read to its end while the form is parsed, so its size is known here. The form
    # closes its files when the block ends.
    # rb:handler forms.multipart
    async def multipart(request: Request) -> JSONResponse:
        """
        requestBody: {required: true, content: {multipart/form-data: {schema: {$ref: "#/components/schemas/Upload"}}}}
        responses:
          200: {description: The file's name and size and the two fields, content: {application/json: {schema: {$ref: "#/components/schemas/Uploaded"}}}}
        """
        async with request.form() as form:
            upload = form["file"]
            return JSONResponse({"file": {"name": upload.filename, "bytes": upload.size},
                                 "echo": {"tenant": form["tenant"], "requestId": form["requestId"]}})

    return [
        Route("/forms/urlencoded", urlencoded, methods=["POST"]),
        Route("/forms/multipart", multipart, methods=["POST"]),
    ]
