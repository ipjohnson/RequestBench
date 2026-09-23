from __future__ import annotations
from collections.abc import Callable
from dataclasses import dataclass, field
from kiota_abstractions.base_request_builder import BaseRequestBuilder
from kiota_abstractions.base_request_configuration import RequestConfiguration
from kiota_abstractions.default_query_parameters import QueryParameters
from kiota_abstractions.get_path_parameters import get_path_parameters
from kiota_abstractions.method import Method
from kiota_abstractions.request_adapter import RequestAdapter
from kiota_abstractions.request_information import RequestInformation
from kiota_abstractions.request_option import RequestOption
from kiota_abstractions.serialization import Parsable, ParsableFactory
from typing import Any, Optional, TYPE_CHECKING, Union
from warnings import warn

if TYPE_CHECKING:
    from ...models.echoed_search import EchoedSearch
    from ...models.refusal import Refusal

class ManyRequestBuilder(BaseRequestBuilder):
    """
    Builds and executes requests for operations under /query/many
    """
    def __init__(self,request_adapter: RequestAdapter, path_parameters: Union[str, dict[str, Any]]) -> None:
        """
        Instantiates a new ManyRequestBuilder and sets the default values.
        param path_parameters: The raw url or the url-template parameters for the request.
        param request_adapter: The request adapter to use to execute the requests.
        Returns: None
        """
        super().__init__(request_adapter, "{+baseurl}/query/many?category={category}&maxPrice={maxPrice}&minPrice={minPrice}&page={page}&q={q}&size={size}&sort={sort}&status={status}", path_parameters)
    
    async def get(self,request_configuration: Optional[RequestConfiguration[ManyRequestBuilderGetQueryParameters]] = None) -> Optional[EchoedSearch]:
        """
        Many
        param request_configuration: Configuration for the request such as headers, query parameters, and middleware options.
        Returns: Optional[EchoedSearch]
        """
        request_info = self.to_get_request_information(
            request_configuration
        )
        from ...models.refusal import Refusal

        error_mapping: dict[str, type[ParsableFactory]] = {
            "400": Refusal,
        }
        if not self.request_adapter:
            raise Exception("Http core is null") 
        from ...models.echoed_search import EchoedSearch

        return await self.request_adapter.send_async(request_info, EchoedSearch, error_mapping)
    
    def to_get_request_information(self,request_configuration: Optional[RequestConfiguration[ManyRequestBuilderGetQueryParameters]] = None) -> RequestInformation:
        """
        Many
        param request_configuration: Configuration for the request such as headers, query parameters, and middleware options.
        Returns: RequestInformation
        """
        request_info = RequestInformation(Method.GET, self.url_template, self.path_parameters)
        request_info.configure(request_configuration)
        request_info.headers.try_add("Accept", "application/json")
        return request_info
    
    def with_url(self,raw_url: str) -> ManyRequestBuilder:
        """
        Returns a request builder with the provided arbitrary URL. Using this method means any other path or query parameters are ignored.
        param raw_url: The raw URL to use for the request builder.
        Returns: ManyRequestBuilder
        """
        if raw_url is None:
            raise TypeError("raw_url cannot be null.")
        return ManyRequestBuilder(self.request_adapter, raw_url)
    
    @dataclass
    class ManyRequestBuilderGetQueryParameters():
        """
        Many
        """
        def get_query_parameter(self,original_name: str) -> str:
            """
            Maps the query parameters names to their encoded names for the URI template parsing.
            param original_name: The original query parameter name in the class.
            Returns: str
            """
            if original_name is None:
                raise TypeError("original_name cannot be null.")
            if original_name == "max_price":
                return "maxPrice"
            if original_name == "min_price":
                return "minPrice"
            if original_name == "category":
                return "category"
            if original_name == "page":
                return "page"
            if original_name == "q":
                return "q"
            if original_name == "size":
                return "size"
            if original_name == "sort":
                return "sort"
            if original_name == "status":
                return "status"
            return original_name
        
        category: Optional[str] = None

        max_price: Optional[int] = None

        min_price: Optional[int] = None

        page: Optional[int] = None

        q: Optional[str] = None

        size: Optional[int] = None

        sort: Optional[str] = None

        status: Optional[str] = None

    
    @dataclass
    class ManyRequestBuilderGetRequestConfiguration(RequestConfiguration[ManyRequestBuilderGetQueryParameters]):
        """
        Configuration for the request such as headers, query parameters, and middleware options.
        """
        warn("This class is deprecated. Please use the generic RequestConfiguration class generated by the generator.", DeprecationWarning)
    

