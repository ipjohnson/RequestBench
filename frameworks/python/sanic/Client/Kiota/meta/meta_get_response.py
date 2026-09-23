from __future__ import annotations
from collections.abc import Callable
from dataclasses import dataclass, field
from kiota_abstractions.serialization import AdditionalDataHolder, Parsable, ParseNode, SerializationWriter
from typing import Any, Optional, TYPE_CHECKING, Union

if TYPE_CHECKING:
    from .meta_get_response_clear import MetaGetResponse_clear
    from .meta_get_response_copy import MetaGetResponse_copy
    from .meta_get_response_fromkeys import MetaGetResponse_fromkeys
    from .meta_get_response_get import MetaGetResponse_get
    from .meta_get_response_items import MetaGetResponse_items
    from .meta_get_response_keys import MetaGetResponse_keys
    from .meta_get_response_pop import MetaGetResponse_pop
    from .meta_get_response_popitem import MetaGetResponse_popitem
    from .meta_get_response_setdefault import MetaGetResponse_setdefault
    from .meta_get_response_update import MetaGetResponse_update
    from .meta_get_response_values import MetaGetResponse_values

@dataclass
class MetaGetResponse(AdditionalDataHolder, Parsable):
    # Stores additional data not described in the OpenAPI description found when deserializing. Can be used for serialization as well.
    additional_data: dict[str, Any] = field(default_factory=dict)

    # The clear property
    clear: Optional[MetaGetResponse_clear] = None
    # The copy property
    copy: Optional[MetaGetResponse_copy] = None
    # The fromkeys property
    fromkeys: Optional[MetaGetResponse_fromkeys] = None
    # The get property
    get: Optional[MetaGetResponse_get] = None
    # The items property
    items: Optional[MetaGetResponse_items] = None
    # The keys property
    keys: Optional[MetaGetResponse_keys] = None
    # The pop property
    pop: Optional[MetaGetResponse_pop] = None
    # The popitem property
    popitem: Optional[MetaGetResponse_popitem] = None
    # The setdefault property
    setdefault: Optional[MetaGetResponse_setdefault] = None
    # The update property
    update: Optional[MetaGetResponse_update] = None
    # The values property
    values: Optional[MetaGetResponse_values] = None
    
    @staticmethod
    def create_from_discriminator_value(parse_node: ParseNode) -> MetaGetResponse:
        """
        Creates a new instance of the appropriate class based on discriminator value
        param parse_node: The parse node to use to read the discriminator value and create the object
        Returns: MetaGetResponse
        """
        if parse_node is None:
            raise TypeError("parse_node cannot be null.")
        return MetaGetResponse()
    
    def get_field_deserializers(self,) -> dict[str, Callable[[ParseNode], None]]:
        """
        The deserialization information for the current model
        Returns: dict[str, Callable[[ParseNode], None]]
        """
        from .meta_get_response_clear import MetaGetResponse_clear
        from .meta_get_response_copy import MetaGetResponse_copy
        from .meta_get_response_fromkeys import MetaGetResponse_fromkeys
        from .meta_get_response_get import MetaGetResponse_get
        from .meta_get_response_items import MetaGetResponse_items
        from .meta_get_response_keys import MetaGetResponse_keys
        from .meta_get_response_pop import MetaGetResponse_pop
        from .meta_get_response_popitem import MetaGetResponse_popitem
        from .meta_get_response_setdefault import MetaGetResponse_setdefault
        from .meta_get_response_update import MetaGetResponse_update
        from .meta_get_response_values import MetaGetResponse_values

        from .meta_get_response_clear import MetaGetResponse_clear
        from .meta_get_response_copy import MetaGetResponse_copy
        from .meta_get_response_fromkeys import MetaGetResponse_fromkeys
        from .meta_get_response_get import MetaGetResponse_get
        from .meta_get_response_items import MetaGetResponse_items
        from .meta_get_response_keys import MetaGetResponse_keys
        from .meta_get_response_pop import MetaGetResponse_pop
        from .meta_get_response_popitem import MetaGetResponse_popitem
        from .meta_get_response_setdefault import MetaGetResponse_setdefault
        from .meta_get_response_update import MetaGetResponse_update
        from .meta_get_response_values import MetaGetResponse_values

        fields: dict[str, Callable[[Any], None]] = {
            "clear": lambda n : setattr(self, 'clear', n.get_object_value(MetaGetResponse_clear)),
            "copy": lambda n : setattr(self, 'copy', n.get_object_value(MetaGetResponse_copy)),
            "fromkeys": lambda n : setattr(self, 'fromkeys', n.get_object_value(MetaGetResponse_fromkeys)),
            "get": lambda n : setattr(self, 'get', n.get_object_value(MetaGetResponse_get)),
            "items": lambda n : setattr(self, 'items', n.get_object_value(MetaGetResponse_items)),
            "keys": lambda n : setattr(self, 'keys', n.get_object_value(MetaGetResponse_keys)),
            "pop": lambda n : setattr(self, 'pop', n.get_object_value(MetaGetResponse_pop)),
            "popitem": lambda n : setattr(self, 'popitem', n.get_object_value(MetaGetResponse_popitem)),
            "setdefault": lambda n : setattr(self, 'setdefault', n.get_object_value(MetaGetResponse_setdefault)),
            "update": lambda n : setattr(self, 'update', n.get_object_value(MetaGetResponse_update)),
            "values": lambda n : setattr(self, 'values', n.get_object_value(MetaGetResponse_values)),
        }
        return fields
    
    def serialize(self,writer: SerializationWriter) -> None:
        """
        Serializes information the current object
        param writer: Serialization writer to use to serialize this model
        Returns: None
        """
        if writer is None:
            raise TypeError("writer cannot be null.")
        writer.write_object_value("clear", self.clear)
        writer.write_object_value("copy", self.copy)
        writer.write_object_value("fromkeys", self.fromkeys)
        writer.write_object_value("get", self.get)
        writer.write_object_value("items", self.items)
        writer.write_object_value("keys", self.keys)
        writer.write_object_value("pop", self.pop)
        writer.write_object_value("popitem", self.popitem)
        writer.write_object_value("setdefault", self.setdefault)
        writer.write_object_value("update", self.update)
        writer.write_object_value("values", self.values)
        writer.write_additional_data_value(self.additional_data)
    

