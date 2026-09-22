from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from payloads import Payload, Payloads


def router(p: Payloads) -> APIRouter:
    """authorized: FastAPI's bearer scheme reads the token, and a dependency on the route compares it
    before the handler runs."""
    token = p.settings.token

    # rb:wiring authorized.*
    bearer = HTTPBearer()

    async def require_token(credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer)]) -> None:
        """A request with no bearer token is HTTPBearer's own 401. Any token but settings.json's is 403."""
        if credentials.credentials != token:
            raise HTTPException(status_code=403)
    # rb:end

    routes = APIRouter()

    @routes.get("/authorized/small", dependencies=[Depends(require_token)])
    async def small() -> Payload:
        return p.small

    return routes
