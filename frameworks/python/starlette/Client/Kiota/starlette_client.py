from __future__ import annotations
from collections.abc import Callable
from kiota_abstractions.api_client_builder import enable_backing_store_for_serialization_writer_factory, register_default_deserializer, register_default_serializer
from kiota_abstractions.base_request_builder import BaseRequestBuilder
from kiota_abstractions.get_path_parameters import get_path_parameters
from kiota_abstractions.request_adapter import RequestAdapter
from kiota_abstractions.serialization import ParseNodeFactoryRegistry, SerializationWriterFactoryRegistry
from kiota_serialization_form.form_parse_node_factory import FormParseNodeFactory
from kiota_serialization_form.form_serialization_writer_factory import FormSerializationWriterFactory
from kiota_serialization_json.json_parse_node_factory import JsonParseNodeFactory
from kiota_serialization_json.json_serialization_writer_factory import JsonSerializationWriterFactory
from kiota_serialization_multipart.multipart_serialization_writer_factory import MultipartSerializationWriterFactory
from kiota_serialization_text.text_parse_node_factory import TextParseNodeFactory
from kiota_serialization_text.text_serialization_writer_factory import TextSerializationWriterFactory
from typing import Any, Optional, TYPE_CHECKING, Union

if TYPE_CHECKING:
    from .authorized.authorized_request_builder import AuthorizedRequestBuilder
    from .body.body_request_builder import BodyRequestBuilder
    from .cache.cache_request_builder import CacheRequestBuilder
    from .compressed.compressed_request_builder import CompressedRequestBuilder
    from .cors.cors_request_builder import CorsRequestBuilder
    from .etag.etag_request_builder import EtagRequestBuilder
    from .forms.forms_request_builder import FormsRequestBuilder
    from .headers.headers_request_builder import HeadersRequestBuilder
    from .health.health_request_builder import HealthRequestBuilder
    from .items.items_request_builder import ItemsRequestBuilder
    from .json_escaped.json_request_builder import JsonRequestBuilder
    from .meta.meta_request_builder import MetaRequestBuilder
    from .middleware.middleware_request_builder import MiddlewareRequestBuilder
    from .parameters.parameters_request_builder import ParametersRequestBuilder
    from .plaintext.plaintext_request_builder import PlaintextRequestBuilder
    from .query.query_request_builder import QueryRequestBuilder
    from .sse.sse_request_builder import SseRequestBuilder
    from .stream.stream_request_builder import StreamRequestBuilder
    from .template.template_request_builder import TemplateRequestBuilder

class StarletteClient(BaseRequestBuilder):
    """
    The main entry point of the SDK, exposes the configuration and the fluent API.
    """
    def __init__(self,request_adapter: RequestAdapter) -> None:
        """
        Instantiates a new StarletteClient and sets the default values.
        param request_adapter: The request adapter to use to execute the requests.
        Returns: None
        """
        if request_adapter is None:
            raise TypeError("request_adapter cannot be null.")
        super().__init__(request_adapter, "{+baseurl}", None)
        register_default_serializer(JsonSerializationWriterFactory)
        register_default_serializer(TextSerializationWriterFactory)
        register_default_serializer(FormSerializationWriterFactory)
        register_default_serializer(MultipartSerializationWriterFactory)
        register_default_deserializer(JsonParseNodeFactory)
        register_default_deserializer(TextParseNodeFactory)
        register_default_deserializer(FormParseNodeFactory)
    
    @property
    def authorized(self) -> AuthorizedRequestBuilder:
        """
        The authorized property
        """
        from .authorized.authorized_request_builder import AuthorizedRequestBuilder

        return AuthorizedRequestBuilder(self.request_adapter, self.path_parameters)
    
    @property
    def body(self) -> BodyRequestBuilder:
        """
        The body property
        """
        from .body.body_request_builder import BodyRequestBuilder

        return BodyRequestBuilder(self.request_adapter, self.path_parameters)
    
    @property
    def cache(self) -> CacheRequestBuilder:
        """
        The cache property
        """
        from .cache.cache_request_builder import CacheRequestBuilder

        return CacheRequestBuilder(self.request_adapter, self.path_parameters)
    
    @property
    def compressed(self) -> CompressedRequestBuilder:
        """
        The compressed property
        """
        from .compressed.compressed_request_builder import CompressedRequestBuilder

        return CompressedRequestBuilder(self.request_adapter, self.path_parameters)
    
    @property
    def cors(self) -> CorsRequestBuilder:
        """
        The cors property
        """
        from .cors.cors_request_builder import CorsRequestBuilder

        return CorsRequestBuilder(self.request_adapter, self.path_parameters)
    
    @property
    def etag(self) -> EtagRequestBuilder:
        """
        The etag property
        """
        from .etag.etag_request_builder import EtagRequestBuilder

        return EtagRequestBuilder(self.request_adapter, self.path_parameters)
    
    @property
    def forms(self) -> FormsRequestBuilder:
        """
        The forms property
        """
        from .forms.forms_request_builder import FormsRequestBuilder

        return FormsRequestBuilder(self.request_adapter, self.path_parameters)
    
    @property
    def headers(self) -> HeadersRequestBuilder:
        """
        The headers property
        """
        from .headers.headers_request_builder import HeadersRequestBuilder

        return HeadersRequestBuilder(self.request_adapter, self.path_parameters)
    
    @property
    def health(self) -> HealthRequestBuilder:
        """
        The health property
        """
        from .health.health_request_builder import HealthRequestBuilder

        return HealthRequestBuilder(self.request_adapter, self.path_parameters)
    
    @property
    def items(self) -> ItemsRequestBuilder:
        """
        The items property
        """
        from .items.items_request_builder import ItemsRequestBuilder

        return ItemsRequestBuilder(self.request_adapter, self.path_parameters)
    
    @property
    def json(self) -> JsonRequestBuilder:
        """
        The json property
        """
        from .json_escaped.json_request_builder import JsonRequestBuilder

        return JsonRequestBuilder(self.request_adapter, self.path_parameters)
    
    @property
    def meta(self) -> MetaRequestBuilder:
        """
        The meta property
        """
        from .meta.meta_request_builder import MetaRequestBuilder

        return MetaRequestBuilder(self.request_adapter, self.path_parameters)
    
    @property
    def middleware(self) -> MiddlewareRequestBuilder:
        """
        The middleware property
        """
        from .middleware.middleware_request_builder import MiddlewareRequestBuilder

        return MiddlewareRequestBuilder(self.request_adapter, self.path_parameters)
    
    @property
    def parameters(self) -> ParametersRequestBuilder:
        """
        The parameters property
        """
        from .parameters.parameters_request_builder import ParametersRequestBuilder

        return ParametersRequestBuilder(self.request_adapter, self.path_parameters)
    
    @property
    def plaintext(self) -> PlaintextRequestBuilder:
        """
        The plaintext property
        """
        from .plaintext.plaintext_request_builder import PlaintextRequestBuilder

        return PlaintextRequestBuilder(self.request_adapter, self.path_parameters)
    
    @property
    def query(self) -> QueryRequestBuilder:
        """
        The query property
        """
        from .query.query_request_builder import QueryRequestBuilder

        return QueryRequestBuilder(self.request_adapter, self.path_parameters)
    
    @property
    def sse(self) -> SseRequestBuilder:
        """
        The sse property
        """
        from .sse.sse_request_builder import SseRequestBuilder

        return SseRequestBuilder(self.request_adapter, self.path_parameters)
    
    @property
    def stream(self) -> StreamRequestBuilder:
        """
        The stream property
        """
        from .stream.stream_request_builder import StreamRequestBuilder

        return StreamRequestBuilder(self.request_adapter, self.path_parameters)
    
    @property
    def template(self) -> TemplateRequestBuilder:
        """
        The template property
        """
        from .template.template_request_builder import TemplateRequestBuilder

        return TemplateRequestBuilder(self.request_adapter, self.path_parameters)
    

