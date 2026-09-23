from pathlib import Path

from starlette.requests import Request
from starlette.responses import Response
from starlette.routing import BaseRoute, Route
# rb:wiring template.*
from starlette.templating import Jinja2Templates

from payloads import Json, Payloads

# Starlette has no view layer of its own, and Jinja2Templates is what its documentation renders with.
# rb:wiring template.*
TEMPLATES = Jinja2Templates(directory=Path(__file__).parent.parent / "templates")


def routes(p: Payloads) -> list[BaseRoute]:
    """template: the payload rendered by a Jinja2 template, which the environment compiles once."""

    # rb:handler template.small
    async def small(request: Request) -> Response:
        """
        responses:
          200: {description: items.small rendered, content: {text/html: {schema: {type: string}}}}
        """
        return page(request, p.small)

    # rb:handler template.medium
    async def medium(request: Request) -> Response:
        """
        responses:
          200: {description: items.medium rendered, content: {text/html: {schema: {type: string}}}}
        """
        return page(request, p.medium)

    return [
        Route("/template/small", small),
        Route("/template/medium", medium),
    ]


def page(request: Request, payload: Json) -> Response:
    return TEMPLATES.TemplateResponse(request, "items.html", {"page": payload})
