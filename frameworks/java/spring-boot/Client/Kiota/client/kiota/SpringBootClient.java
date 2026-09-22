package client.kiota;

import client.kiota.authorized.AuthorizedRequestBuilder;
import client.kiota.body.BodyRequestBuilder;
import client.kiota.cache.CacheRequestBuilder;
import client.kiota.compressed.CompressedRequestBuilder;
import client.kiota.cors.CorsRequestBuilder;
import client.kiota.etag.EtagRequestBuilder;
import client.kiota.forms.FormsRequestBuilder;
import client.kiota.headers.HeadersRequestBuilder;
import client.kiota.health.HealthRequestBuilder;
import client.kiota.items.ItemsRequestBuilder;
import client.kiota.jsonescaped.JsonRequestBuilder;
import client.kiota.meta.MetaRequestBuilder;
import client.kiota.middleware.MiddlewareRequestBuilder;
import client.kiota.parameters.ParametersRequestBuilder;
import client.kiota.plaintext.PlaintextRequestBuilder;
import client.kiota.query.QueryRequestBuilder;
import client.kiota.sse.SseRequestBuilder;
import client.kiota.stream.StreamRequestBuilder;
import com.microsoft.kiota.ApiClientBuilder;
import com.microsoft.kiota.BaseRequestBuilder;
import com.microsoft.kiota.RequestAdapter;
import com.microsoft.kiota.serialization.ParseNodeFactoryRegistry;
import com.microsoft.kiota.serialization.SerializationWriterFactoryRegistry;
import java.util.HashMap;
import java.util.Objects;
/**
 * The main entry point of the SDK, exposes the configuration and the fluent API.
 */
@jakarta.annotation.Generated("com.microsoft.kiota")
public class SpringBootClient extends BaseRequestBuilder {
    /**
     * The authorized property
     * @return a {@link AuthorizedRequestBuilder}
     */
    @jakarta.annotation.Nonnull
    public AuthorizedRequestBuilder authorized() {
        return new AuthorizedRequestBuilder(pathParameters, requestAdapter);
    }
    /**
     * The body property
     * @return a {@link BodyRequestBuilder}
     */
    @jakarta.annotation.Nonnull
    public BodyRequestBuilder body() {
        return new BodyRequestBuilder(pathParameters, requestAdapter);
    }
    /**
     * The cache property
     * @return a {@link CacheRequestBuilder}
     */
    @jakarta.annotation.Nonnull
    public CacheRequestBuilder cache() {
        return new CacheRequestBuilder(pathParameters, requestAdapter);
    }
    /**
     * The compressed property
     * @return a {@link CompressedRequestBuilder}
     */
    @jakarta.annotation.Nonnull
    public CompressedRequestBuilder compressed() {
        return new CompressedRequestBuilder(pathParameters, requestAdapter);
    }
    /**
     * The cors property
     * @return a {@link CorsRequestBuilder}
     */
    @jakarta.annotation.Nonnull
    public CorsRequestBuilder cors() {
        return new CorsRequestBuilder(pathParameters, requestAdapter);
    }
    /**
     * The etag property
     * @return a {@link EtagRequestBuilder}
     */
    @jakarta.annotation.Nonnull
    public EtagRequestBuilder etag() {
        return new EtagRequestBuilder(pathParameters, requestAdapter);
    }
    /**
     * The forms property
     * @return a {@link FormsRequestBuilder}
     */
    @jakarta.annotation.Nonnull
    public FormsRequestBuilder forms() {
        return new FormsRequestBuilder(pathParameters, requestAdapter);
    }
    /**
     * The headers property
     * @return a {@link HeadersRequestBuilder}
     */
    @jakarta.annotation.Nonnull
    public HeadersRequestBuilder headers() {
        return new HeadersRequestBuilder(pathParameters, requestAdapter);
    }
    /**
     * The health property
     * @return a {@link HealthRequestBuilder}
     */
    @jakarta.annotation.Nonnull
    public HealthRequestBuilder health() {
        return new HealthRequestBuilder(pathParameters, requestAdapter);
    }
    /**
     * The items property
     * @return a {@link ItemsRequestBuilder}
     */
    @jakarta.annotation.Nonnull
    public ItemsRequestBuilder items() {
        return new ItemsRequestBuilder(pathParameters, requestAdapter);
    }
    /**
     * The json property
     * @return a {@link JsonRequestBuilder}
     */
    @jakarta.annotation.Nonnull
    public JsonRequestBuilder json() {
        return new JsonRequestBuilder(pathParameters, requestAdapter);
    }
    /**
     * The meta property
     * @return a {@link MetaRequestBuilder}
     */
    @jakarta.annotation.Nonnull
    public MetaRequestBuilder meta() {
        return new MetaRequestBuilder(pathParameters, requestAdapter);
    }
    /**
     * The middleware property
     * @return a {@link MiddlewareRequestBuilder}
     */
    @jakarta.annotation.Nonnull
    public MiddlewareRequestBuilder middleware() {
        return new MiddlewareRequestBuilder(pathParameters, requestAdapter);
    }
    /**
     * The parameters property
     * @return a {@link ParametersRequestBuilder}
     */
    @jakarta.annotation.Nonnull
    public ParametersRequestBuilder parameters() {
        return new ParametersRequestBuilder(pathParameters, requestAdapter);
    }
    /**
     * The plaintext property
     * @return a {@link PlaintextRequestBuilder}
     */
    @jakarta.annotation.Nonnull
    public PlaintextRequestBuilder plaintext() {
        return new PlaintextRequestBuilder(pathParameters, requestAdapter);
    }
    /**
     * The query property
     * @return a {@link QueryRequestBuilder}
     */
    @jakarta.annotation.Nonnull
    public QueryRequestBuilder query() {
        return new QueryRequestBuilder(pathParameters, requestAdapter);
    }
    /**
     * The sse property
     * @return a {@link SseRequestBuilder}
     */
    @jakarta.annotation.Nonnull
    public SseRequestBuilder sse() {
        return new SseRequestBuilder(pathParameters, requestAdapter);
    }
    /**
     * The stream property
     * @return a {@link StreamRequestBuilder}
     */
    @jakarta.annotation.Nonnull
    public StreamRequestBuilder stream() {
        return new StreamRequestBuilder(pathParameters, requestAdapter);
    }
    /**
     * Instantiates a new {@link SpringBootClient} and sets the default values.
     * @param requestAdapter The request adapter to use to execute the requests.
     */
    public SpringBootClient(@jakarta.annotation.Nonnull final RequestAdapter requestAdapter) {
        super(requestAdapter, "{+baseurl}");
        this.pathParameters = new HashMap<>();
        if (requestAdapter.getBaseUrl() == null || requestAdapter.getBaseUrl().isEmpty()) {
            requestAdapter.setBaseUrl("http://localhost:18080");
        }
        pathParameters.put("baseurl", requestAdapter.getBaseUrl());
    }
}
