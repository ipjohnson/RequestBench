from litestar import MediaType, Router, get

from payloads import Payloads


def router(p: Payloads) -> Router:
    """baseline: the dispatch floor, with nothing serialised."""

    @get("/plaintext", media_type=MediaType.TEXT)
    async def plaintext() -> str:
        return "Hello, World!"

    return Router(path="/", route_handlers=[plaintext])
