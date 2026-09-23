from __future__ import annotations
from collections.abc import Callable
from dataclasses import dataclass, field
from kiota_abstractions.serialization import AdditionalDataHolder, Parsable, ParseNode, SerializationWriter
from typing import Any, Optional, TYPE_CHECKING, Union

@dataclass
class NewItem(AdditionalDataHolder, Parsable):
    """
    An item as a client creates or replaces one.
    """
    # Stores additional data not described in the OpenAPI description found when deserializing. Can be used for serialization as well.
    additional_data: dict[str, Any] = field(default_factory=dict)

    # The category property
    category: Optional[str] = None
    # The inStock property
    in_stock: Optional[bool] = None
    # The name property
    name: Optional[str] = None
    # The priceCents property
    price_cents: Optional[int] = None
    
    @staticmethod
    def create_from_discriminator_value(parse_node: ParseNode) -> NewItem:
        """
        Creates a new instance of the appropriate class based on discriminator value
        param parse_node: The parse node to use to read the discriminator value and create the object
        Returns: NewItem
        """
        if parse_node is None:
            raise TypeError("parse_node cannot be null.")
        return NewItem()
    
    def get_field_deserializers(self,) -> dict[str, Callable[[ParseNode], None]]:
        """
        The deserialization information for the current model
        Returns: dict[str, Callable[[ParseNode], None]]
        """
        fields: dict[str, Callable[[Any], None]] = {
            "category": lambda n : setattr(self, 'category', n.get_str_value()),
            "inStock": lambda n : setattr(self, 'in_stock', n.get_bool_value()),
            "name": lambda n : setattr(self, 'name', n.get_str_value()),
            "priceCents": lambda n : setattr(self, 'price_cents', n.get_int_value()),
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
        writer.write_str_value("category", self.category)
        writer.write_bool_value("inStock", self.in_stock)
        writer.write_str_value("name", self.name)
        writer.write_int_value("priceCents", self.price_cents)
        writer.write_additional_data_value(self.additional_data)
    

