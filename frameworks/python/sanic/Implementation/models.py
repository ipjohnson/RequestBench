from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class Camel(BaseModel):
    """A model sanic-ext's @validate binds, whose JSON names are camelCase, as every name in the
    corpus is. Sanic Extensions validates a Pydantic model with model_validate."""

    model_config = ConfigDict(alias_generator=to_camel, validate_by_name=True, serialize_by_alias=True)
