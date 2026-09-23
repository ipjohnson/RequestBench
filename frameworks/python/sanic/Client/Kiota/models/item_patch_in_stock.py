from __future__ import annotations
from collections.abc import Callable
from dataclasses import dataclass, field
from kiota_abstractions.serialization import ComposedTypeWrapper, Parsable, ParseNode, ParseNodeHelper, SerializationWriter
from typing import Any, Optional, TYPE_CHECKING, Union

if TYPE_CHECKING:
    from .item_patch_in_stock_member1 import ItemPatch_inStockMember1

@dataclass
class ItemPatch_inStock(ComposedTypeWrapper, Parsable):
    """
    Composed type wrapper for classes bool, ItemPatch_inStockMember1
    """
    # Composed type representation for type bool
    boolean: Optional[bool] = None
    # Composed type representation for type ItemPatch_inStockMember1
    item_patch_in_stock_member1: Optional[ItemPatch_inStockMember1] = None
    
    @staticmethod
    def create_from_discriminator_value(parse_node: ParseNode) -> ItemPatch_inStock:
        """
        Creates a new instance of the appropriate class based on discriminator value
        param parse_node: The parse node to use to read the discriminator value and create the object
        Returns: ItemPatch_inStock
        """
        if parse_node is None:
            raise TypeError("parse_node cannot be null.")
        result = ItemPatch_inStock()
        if boolean_value := parse_node.get_bool_value():
            result.boolean = boolean_value
        else:
            from .item_patch_in_stock_member1 import ItemPatch_inStockMember1

            result.item_patch_in_stock_member1 = ItemPatch_inStockMember1()
        return result
    
    def get_field_deserializers(self,) -> dict[str, Callable[[ParseNode], None]]:
        """
        The deserialization information for the current model
        Returns: dict[str, Callable[[ParseNode], None]]
        """
        from .item_patch_in_stock_member1 import ItemPatch_inStockMember1

        if self.item_patch_in_stock_member1:
            return ParseNodeHelper.merge_deserializers_for_intersection_wrapper(self.item_patch_in_stock_member1)
        return {}
    
    def serialize(self,writer: SerializationWriter) -> None:
        """
        Serializes information the current object
        param writer: Serialization writer to use to serialize this model
        Returns: None
        """
        if writer is None:
            raise TypeError("writer cannot be null.")
        if self.boolean:
            writer.write_bool_value(None, self.boolean)
        else:
            writer.write_object_value(None, self.item_patch_in_stock_member1)
    

