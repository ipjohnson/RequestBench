from __future__ import annotations
from collections.abc import Callable
from dataclasses import dataclass, field
from kiota_abstractions.serialization import AdditionalDataHolder, Parsable, ParseNode, SerializationWriter
from typing import Any, Optional, TYPE_CHECKING, Union

if TYPE_CHECKING:
    from .item import Item

@dataclass
class Payload(AdditionalDataHolder, Parsable):
    """
    items.small, items.medium or items.large.
    """
    # Stores additional data not described in the OpenAPI description found when deserializing. Can be used for serialization as well.
    additional_data: dict[str, Any] = field(default_factory=dict)

    # The count property
    count: Optional[int] = None
    # The items property
    items: Optional[list[Item]] = None
    # The size property
    size: Optional[str] = None
    
    @staticmethod
    def create_from_discriminator_value(parse_node: ParseNode) -> Payload:
        """
        Creates a new instance of the appropriate class based on discriminator value
        param parse_node: The parse node to use to read the discriminator value and create the object
        Returns: Payload
        """
        if parse_node is None:
            raise TypeError("parse_node cannot be null.")
        return Payload()
    
    def get_field_deserializers(self,) -> dict[str, Callable[[ParseNode], None]]:
        """
        The deserialization information for the current model
        Returns: dict[str, Callable[[ParseNode], None]]
        """
        from .item import Item

        from .item import Item

        fields: dict[str, Callable[[Any], None]] = {
            "count": lambda n : setattr(self, 'count', n.get_int_value()),
            "items": lambda n : setattr(self, 'items', n.get_collection_of_object_values(Item)),
            "size": lambda n : setattr(self, 'size', n.get_str_value()),
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
        writer.write_int_value("count", self.count)
        writer.write_collection_of_object_values("items", self.items)
        writer.write_str_value("size", self.size)
        writer.write_additional_data_value(self.additional_data)
    

