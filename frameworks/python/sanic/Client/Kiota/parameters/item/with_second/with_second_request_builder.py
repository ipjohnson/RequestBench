from __future__ import annotations
from collections.abc import Callable
from kiota_abstractions.base_request_builder import BaseRequestBuilder
from kiota_abstractions.get_path_parameters import get_path_parameters
from kiota_abstractions.request_adapter import RequestAdapter
from typing import Any, Optional, TYPE_CHECKING, Union

if TYPE_CHECKING:
    from .item.with_two_item_request_builder import WithTwoItemRequestBuilder

class WithSecondRequestBuilder(BaseRequestBuilder):
    """
    Builds and executes requests for operations under /parameters/{one}/with-second
    """
    def __init__(self,request_adapter: RequestAdapter, path_parameters: Union[str, dict[str, Any]]) -> None:
        """
        Instantiates a new WithSecondRequestBuilder and sets the default values.
        param path_parameters: The raw url or the url-template parameters for the request.
        param request_adapter: The request adapter to use to execute the requests.
        Returns: None
        """
        super().__init__(request_adapter, "{+baseurl}/parameters/{one}/with-second", path_parameters)
    
    def by_two(self,two: int) -> WithTwoItemRequestBuilder:
        """
        Gets an item from the Kiota.parameters.item.withSecond.item collection
        param two: Unique identifier of the item
        Returns: WithTwoItemRequestBuilder
        """
        if two is None:
            raise TypeError("two cannot be null.")
        from .item.with_two_item_request_builder import WithTwoItemRequestBuilder

        url_tpl_params = get_path_parameters(self.path_parameters)
        url_tpl_params["two"] = two
        return WithTwoItemRequestBuilder(self.request_adapter, url_tpl_params)
    

