from litestar import Router, post
from litestar.datastructures import UploadFile
from litestar.params import MultipartBody, URLEncodedBody

from answers import Echoed
from payloads import Camel, Payloads
from routes.query import Search


class Upload(Camel):
    """What forms.multipart posts: two fields and a file."""

    tenant: str
    request_id: str
    file: UploadFile


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


def router(p: Payloads) -> Router:
    """forms: the same eight values query.many reads, from a urlencoded body, and an upload. Litestar
    parses both and converts them to the data parameter's Struct."""

    @post("/forms/urlencoded", status_code=200)
    async def urlencoded(data: URLEncodedBody[Search]) -> Echoed[Search]:
        return Echoed[Search].of(p.small, data)

    # Litestar's UploadFile keeps no size, so the handler reads the file to learn it.
    @post("/forms/multipart", status_code=200)
    async def multipart(data: MultipartBody[Upload]) -> Uploaded:
        content = await data.file.read()
        return Uploaded(file=UploadedFile(name=data.file.filename, bytes=len(content)),
                        echo=UploadEcho(tenant=data.tenant, request_id=data.request_id))

    return Router(path="/", route_handlers=[urlencoded, multipart])
