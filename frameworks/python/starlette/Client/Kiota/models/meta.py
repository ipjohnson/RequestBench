from __future__ import annotations
from collections.abc import Callable
from dataclasses import dataclass, field
from kiota_abstractions.serialization import AdditionalDataHolder, Parsable, ParseNode, SerializationWriter
from typing import Any, Optional, TYPE_CHECKING, Union

@dataclass
class Meta(AdditionalDataHolder, Parsable):
    # Stores additional data not described in the OpenAPI description found when deserializing. Can be used for serialization as well.
    additional_data: dict[str, Any] = field(default_factory=dict)

    # The adapter property
    adapter: Optional[str] = None
    # The framework property
    framework: Optional[str] = None
    # The runtime property
    runtime: Optional[str] = None
    # The serializer property
    serializer: Optional[str] = None
    # The version property
    version: Optional[str] = None
    # The workers property
    workers: Optional[int] = None
    
    @staticmethod
    def create_from_discriminator_value(parse_node: ParseNode) -> Meta:
        """
        Creates a new instance of the appropriate class based on discriminator value
        param parse_node: The parse node to use to read the discriminator value and create the object
        Returns: Meta
        """
        if parse_node is None:
            raise TypeError("parse_node cannot be null.")
        return Meta()
    
    def get_field_deserializers(self,) -> dict[str, Callable[[ParseNode], None]]:
        """
        The deserialization information for the current model
        Returns: dict[str, Callable[[ParseNode], None]]
        """
        fields: dict[str, Callable[[Any], None]] = {
            "adapter": lambda n : setattr(self, 'adapter', n.get_str_value()),
            "framework": lambda n : setattr(self, 'framework', n.get_str_value()),
            "runtime": lambda n : setattr(self, 'runtime', n.get_str_value()),
            "serializer": lambda n : setattr(self, 'serializer', n.get_str_value()),
            "version": lambda n : setattr(self, 'version', n.get_str_value()),
            "workers": lambda n : setattr(self, 'workers', n.get_int_value()),
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
        writer.write_str_value("adapter", self.adapter)
        writer.write_str_value("framework", self.framework)
        writer.write_str_value("runtime", self.runtime)
        writer.write_str_value("serializer", self.serializer)
        writer.write_str_value("version", self.version)
        writer.write_int_value("workers", self.workers)
        writer.write_additional_data_value(self.additional_data)
    

