from typing import Annotated

from fastapi import APIRouter, Form, UploadFile

from answers import Echoed
from payloads import Camel, Payloads
from routes.query import Search


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


def router(p: Payloads) -> APIRouter:
    """forms: the same eight values query.many reads, from a urlencoded body, and an upload. FastAPI
    parses both through python-multipart."""
    routes = APIRouter()

    @routes.post("/forms/urlencoded")
    async def urlencoded(search: Annotated[Search, Form()]) -> Echoed[Search]:
        return Echoed[Search].of(p.small, search)

    # The upload is read to its end before the handler runs, so its size is known here.
    @routes.post("/forms/multipart")
    async def multipart(tenant: Annotated[str, Form()], request_id: Annotated[str, Form(alias="requestId")],
                        file: UploadFile) -> Uploaded:
        return Uploaded(file=UploadedFile(name=file.filename or "", bytes=file.size or 0),
                        echo=UploadEcho(tenant=tenant, request_id=request_id))

    return routes
