from __future__ import annotations
from collections.abc import Callable
from kiota_abstractions.base_request_builder import BaseRequestBuilder
from kiota_abstractions.get_path_parameters import get_path_parameters
from kiota_abstractions.request_adapter import RequestAdapter
from typing import Any, Optional, TYPE_CHECKING, Union

if TYPE_CHECKING:
    from .bind.bind_request_builder import BindRequestBuilder
    from .validate.validate_request_builder import ValidateRequestBuilder

class BodyRequestBuilder(BaseRequestBuilder):
    """
    Builds and executes requests for operations under /body
    """
    def __init__(self,request_adapter: RequestAdapter, path_parameters: Union[str, dict[str, Any]]) -> None:
        """
        Instantiates a new BodyRequestBuilder and sets the default values.
        param path_parameters: The raw url or the url-template parameters for the request.
        param request_adapter: The request adapter to use to execute the requests.
        Returns: None
        """
        super().__init__(request_adapter, "{+baseurl}/body", path_parameters)
    
    @property
    def bind(self) -> BindRequestBuilder:
        """
        The bind property
        """
        from .bind.bind_request_builder import BindRequestBuilder

        return BindRequestBuilder(self.request_adapter, self.path_parameters)
    
    @property
    def validate(self) -> ValidateRequestBuilder:
        """
        The validate property
        """
        from .validate.validate_request_builder import ValidateRequestBuilder

        return ValidateRequestBuilder(self.request_adapter, self.path_parameters)
    

