from __future__ import annotations
from collections.abc import Callable
from kiota_abstractions.base_request_builder import BaseRequestBuilder
from kiota_abstractions.get_path_parameters import get_path_parameters
from kiota_abstractions.request_adapter import RequestAdapter
from typing import Any, Optional, TYPE_CHECKING, Union

if TYPE_CHECKING:
    from .four.four_request_builder import FourRequestBuilder
    from .none_.none_request_builder import NoneRequestBuilder
    from .sixteen.sixteen_request_builder import SixteenRequestBuilder

class MiddlewareRequestBuilder(BaseRequestBuilder):
    """
    Builds and executes requests for operations under /middleware
    """
    def __init__(self,request_adapter: RequestAdapter, path_parameters: Union[str, dict[str, Any]]) -> None:
        """
        Instantiates a new MiddlewareRequestBuilder and sets the default values.
        param path_parameters: The raw url or the url-template parameters for the request.
        param request_adapter: The request adapter to use to execute the requests.
        Returns: None
        """
        super().__init__(request_adapter, "{+baseurl}/middleware", path_parameters)
    
    @property
    def four(self) -> FourRequestBuilder:
        """
        The four property
        """
        from .four.four_request_builder import FourRequestBuilder

        return FourRequestBuilder(self.request_adapter, self.path_parameters)
    
    @property
    def none_(self) -> NoneRequestBuilder:
        """
        The none property
        """
        from .none_.none_request_builder import NoneRequestBuilder

        return NoneRequestBuilder(self.request_adapter, self.path_parameters)
    
    @property
    def sixteen(self) -> SixteenRequestBuilder:
        """
        The sixteen property
        """
        from .sixteen.sixteen_request_builder import SixteenRequestBuilder

        return SixteenRequestBuilder(self.request_adapter, self.path_parameters)
    

