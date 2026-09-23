from starlette.requests import Request
from starlette.responses import PlainTextResponse
from starlette.routing import BaseRoute, Route

from payloads import Payloads


def routes(p: Payloads) -> list[BaseRoute]:
    """baseline: the dispatch floor, with nothing serialised."""

    # rb:handler baseline.plaintext
    async def plaintext(request: Request) -> PlainTextResponse:
        """
        responses:
          200: {description: The string, content: {text/plain: {schema: {type: string}}}}
        """
        return PlainTextResponse("Hello, World!")

    return [Route("/plaintext", plaintext)]
