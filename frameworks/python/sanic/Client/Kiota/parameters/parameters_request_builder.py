from __future__ import annotations
from collections.abc import Callable
from kiota_abstractions.base_request_builder import BaseRequestBuilder
from kiota_abstractions.get_path_parameters import get_path_parameters
from kiota_abstractions.request_adapter import RequestAdapter
from typing import Any, Optional, TYPE_CHECKING, Union

if TYPE_CHECKING:
    from .item.with_one_item_request_builder import WithOneItemRequestBuilder
    from .static.static_request_builder import StaticRequestBuilder

class ParametersRequestBuilder(BaseRequestBuilder):
    """
    Builds and executes requests for operations under /parameters
    """
    def __init__(self,request_adapter: RequestAdapter, path_parameters: Union[str, dict[str, Any]]) -> None:
        """
        Instantiates a new ParametersRequestBuilder and sets the default values.
        param path_parameters: The raw url or the url-template parameters for the request.
        param request_adapter: The request adapter to use to execute the requests.
        Returns: None
        """
        super().__init__(request_adapter, "{+baseurl}/parameters", path_parameters)
    
    def by_one(self,one: int) -> WithOneItemRequestBuilder:
        """
        Gets an item from the Kiota.parameters.item collection
        param one: Unique identifier of the item
        Returns: WithOneItemRequestBuilder
        """
        if one is None:
            raise TypeError("one cannot be null.")
        from .item.with_one_item_request_builder import WithOneItemRequestBuilder

        url_tpl_params = get_path_parameters(self.path_parameters)
        url_tpl_params["one"] = one
        return WithOneItemRequestBuilder(self.request_adapter, url_tpl_params)
    
    @property
    def static(self) -> StaticRequestBuilder:
        """
        The static property
        """
        from .static.static_request_builder import StaticRequestBuilder

        return StaticRequestBuilder(self.request_adapter, self.path_parameters)
    

