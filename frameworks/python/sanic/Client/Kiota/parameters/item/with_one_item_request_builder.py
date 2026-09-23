from __future__ import annotations
from collections.abc import Callable
from kiota_abstractions.base_request_builder import BaseRequestBuilder
from kiota_abstractions.get_path_parameters import get_path_parameters
from kiota_abstractions.request_adapter import RequestAdapter
from typing import Any, Optional, TYPE_CHECKING, Union

if TYPE_CHECKING:
    from .segment.segment_request_builder import SegmentRequestBuilder
    from .with_second.with_second_request_builder import WithSecondRequestBuilder

class WithOneItemRequestBuilder(BaseRequestBuilder):
    """
    Builds and executes requests for operations under /parameters/{one}
    """
    def __init__(self,request_adapter: RequestAdapter, path_parameters: Union[str, dict[str, Any]]) -> None:
        """
        Instantiates a new WithOneItemRequestBuilder and sets the default values.
        param path_parameters: The raw url or the url-template parameters for the request.
        param request_adapter: The request adapter to use to execute the requests.
        Returns: None
        """
        super().__init__(request_adapter, "{+baseurl}/parameters/{one}", path_parameters)
    
    @property
    def segment(self) -> SegmentRequestBuilder:
        """
        The segment property
        """
        from .segment.segment_request_builder import SegmentRequestBuilder

        return SegmentRequestBuilder(self.request_adapter, self.path_parameters)
    
    @property
    def with_second(self) -> WithSecondRequestBuilder:
        """
        The withSecond property
        """
        from .with_second.with_second_request_builder import WithSecondRequestBuilder

        return WithSecondRequestBuilder(self.request_adapter, self.path_parameters)
    

