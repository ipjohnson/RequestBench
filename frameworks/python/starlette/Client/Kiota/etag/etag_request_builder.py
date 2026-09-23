from __future__ import annotations
from collections.abc import Callable
from kiota_abstractions.base_request_builder import BaseRequestBuilder
from kiota_abstractions.get_path_parameters import get_path_parameters
from kiota_abstractions.request_adapter import RequestAdapter
from typing import Any, Optional, TYPE_CHECKING, Union

if TYPE_CHECKING:
    from .large.large_request_builder import LargeRequestBuilder
    from .small.small_request_builder import SmallRequestBuilder

class EtagRequestBuilder(BaseRequestBuilder):
    """
    Builds and executes requests for operations under /etag
    """
    def __init__(self,request_adapter: RequestAdapter, path_parameters: Union[str, dict[str, Any]]) -> None:
        """
        Instantiates a new EtagRequestBuilder and sets the default values.
        param path_parameters: The raw url or the url-template parameters for the request.
        param request_adapter: The request adapter to use to execute the requests.
        Returns: None
        """
        super().__init__(request_adapter, "{+baseurl}/etag", path_parameters)
    
    @property
    def large(self) -> LargeRequestBuilder:
        """
        The large property
        """
        from .large.large_request_builder import LargeRequestBuilder

        return LargeRequestBuilder(self.request_adapter, self.path_parameters)
    
    @property
    def small(self) -> SmallRequestBuilder:
        """
        The small property
        """
        from .small.small_request_builder import SmallRequestBuilder

        return SmallRequestBuilder(self.request_adapter, self.path_parameters)
    

