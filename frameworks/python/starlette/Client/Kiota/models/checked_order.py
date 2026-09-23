from __future__ import annotations
from collections.abc import Callable
from dataclasses import dataclass, field
from kiota_abstractions.serialization import AdditionalDataHolder, Parsable, ParseNode, SerializationWriter
from typing import Any, Optional, TYPE_CHECKING, Union

if TYPE_CHECKING:
    from .checked_line import CheckedLine

@dataclass
class CheckedOrder(AdditionalDataHolder, Parsable):
    # Stores additional data not described in the OpenAPI description found when deserializing. Can be used for serialization as well.
    additional_data: dict[str, Any] = field(default_factory=dict)

    # The customerId property
    customer_id: Optional[int] = None
    # The lines property
    lines: Optional[list[CheckedLine]] = None
    # The status property
    status: Optional[str] = None
    
    @staticmethod
    def create_from_discriminator_value(parse_node: ParseNode) -> CheckedOrder:
        """
        Creates a new instance of the appropriate class based on discriminator value
        param parse_node: The parse node to use to read the discriminator value and create the object
        Returns: CheckedOrder
        """
        if parse_node is None:
            raise TypeError("parse_node cannot be null.")
        return CheckedOrder()
    
    def get_field_deserializers(self,) -> dict[str, Callable[[ParseNode], None]]:
        """
        The deserialization information for the current model
        Returns: dict[str, Callable[[ParseNode], None]]
        """
        from .checked_line import CheckedLine

        from .checked_line import CheckedLine

        fields: dict[str, Callable[[Any], None]] = {
            "customerId": lambda n : setattr(self, 'customer_id', n.get_int_value()),
            "lines": lambda n : setattr(self, 'lines', n.get_collection_of_object_values(CheckedLine)),
            "status": lambda n : setattr(self, 'status', n.get_str_value()),
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
        writer.write_int_value("customerId", self.customer_id)
        writer.write_collection_of_object_values("lines", self.lines)
        writer.write_str_value("status", self.status)
        writer.write_additional_data_value(self.additional_data)
    

