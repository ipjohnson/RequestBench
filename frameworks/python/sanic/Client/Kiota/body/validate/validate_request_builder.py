from __future__ import annotations
from collections.abc import Callable
from kiota_abstractions.base_request_builder import BaseRequestBuilder
from kiota_abstractions.get_path_parameters import get_path_parameters
from kiota_abstractions.request_adapter import RequestAdapter
from typing import Any, Optional, TYPE_CHECKING, Union

if TYPE_CHECKING:
    from .first_error.first_error_request_builder import FirstErrorRequestBuilder
    from .medium.medium_request_builder import MediumRequestBuilder
    from .small.small_request_builder import SmallRequestBuilder

class ValidateRequestBuilder(BaseRequestBuilder):
    """
    Builds and executes requests for operations under /body/validate
    """
    def __init__(self,request_adapter: RequestAdapter, path_parameters: Union[str, dict[str, Any]]) -> None:
        """
        Instantiates a new ValidateRequestBuilder and sets the default values.
        param path_parameters: The raw url or the url-template parameters for the request.
        param request_adapter: The request adapter to use to execute the requests.
        Returns: None
        """
        super().__init__(request_adapter, "{+baseurl}/body/validate", path_parameters)
    
    @property
    def first_error(self) -> FirstErrorRequestBuilder:
        """
        The firstError property
        """
        from .first_error.first_error_request_builder import FirstErrorRequestBuilder

        return FirstErrorRequestBuilder(self.request_adapter, self.path_parameters)
    
    @property
    def medium(self) -> MediumRequestBuilder:
        """
        The medium property
        """
        from .medium.medium_request_builder import MediumRequestBuilder

        return MediumRequestBuilder(self.request_adapter, self.path_parameters)
    
    @property
    def small(self) -> SmallRequestBuilder:
        """
        The small property
        """
        from .small.small_request_builder import SmallRequestBuilder

        return SmallRequestBuilder(self.request_adapter, self.path_parameters)
    

