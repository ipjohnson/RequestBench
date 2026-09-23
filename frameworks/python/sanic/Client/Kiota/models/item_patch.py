from __future__ import annotations
from collections.abc import Callable
from dataclasses import dataclass, field
from kiota_abstractions.serialization import AdditionalDataHolder, Parsable, ParseNode, SerializationWriter
from typing import Any, Optional, TYPE_CHECKING, Union

if TYPE_CHECKING:
    from .item_patch_in_stock import ItemPatch_inStock
    from .item_patch_price_cents import ItemPatch_priceCents

@dataclass
class ItemPatch(AdditionalDataHolder, Parsable):
    """
    The two fields items.update changes.
    """
    # Stores additional data not described in the OpenAPI description found when deserializing. Can be used for serialization as well.
    additional_data: dict[str, Any] = field(default_factory=dict)

    # The inStock property
    in_stock: Optional[ItemPatch_inStock] = None
    # The priceCents property
    price_cents: Optional[ItemPatch_priceCents] = None
    
    @staticmethod
    def create_from_discriminator_value(parse_node: ParseNode) -> ItemPatch:
        """
        Creates a new instance of the appropriate class based on discriminator value
        param parse_node: The parse node to use to read the discriminator value and create the object
        Returns: ItemPatch
        """
        if parse_node is None:
            raise TypeError("parse_node cannot be null.")
        return ItemPatch()
    
    def get_field_deserializers(self,) -> dict[str, Callable[[ParseNode], None]]:
        """
        The deserialization information for the current model
        Returns: dict[str, Callable[[ParseNode], None]]
        """
        from .item_patch_in_stock import ItemPatch_inStock
        from .item_patch_price_cents import ItemPatch_priceCents

        from .item_patch_in_stock import ItemPatch_inStock
        from .item_patch_price_cents import ItemPatch_priceCents

        fields: dict[str, Callable[[Any], None]] = {
            "inStock": lambda n : setattr(self, 'in_stock', n.get_object_value(ItemPatch_inStock)),
            "priceCents": lambda n : setattr(self, 'price_cents', n.get_object_value(ItemPatch_priceCents)),
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
        writer.write_object_value("inStock", self.in_stock)
        writer.write_object_value("priceCents", self.price_cents)
        writer.write_additional_data_value(self.additional_data)
    

