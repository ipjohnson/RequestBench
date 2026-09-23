# rb:wiring body.*,query.*,headers.*,forms.*
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel
from spectree import SpecTree

# Starlette validates nothing itself. SpecTree is the request validation its third-party packages
# page lists: a decorator on the endpoint validates the query string, the headers, a form or a JSON
# body against a Pydantic model before the endpoint runs, puts what it bound on request.context,
# and answers 422 with Pydantic's list of failures when one fails. Its documentation routes are
# never registered.
spec = SpecTree("starlette")


class Camel(BaseModel):
    """A model whose names on the wire are camelCase, as every name in the corpus is."""

    model_config = ConfigDict(alias_generator=to_camel, serialize_by_alias=True)
# rb:end
