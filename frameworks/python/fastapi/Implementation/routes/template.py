from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
# rb:wiring template.*
from fastapi.templating import Jinja2Templates

from payloads import Payload, Payloads

# rb:wiring template.*
# FastAPI has no view layer of its own, and Jinja2Templates is what its documentation reaches for.
TEMPLATES = Jinja2Templates(directory=Path(__file__).parent.parent / "templates")


def router(p: Payloads) -> APIRouter:
    """template: the payload rendered by a Jinja2 template, which the environment compiles once."""
    routes = APIRouter()

    @routes.get("/template/small", response_class=HTMLResponse)
    async def small(request: Request) -> HTMLResponse:
        return page(request, p.small)

    @routes.get("/template/medium", response_class=HTMLResponse)
    async def medium(request: Request) -> HTMLResponse:
        return page(request, p.medium)

    return routes


def page(request: Request, payload: Payload) -> HTMLResponse:
    return TEMPLATES.TemplateResponse(request, "items.html", {"page": payload})
