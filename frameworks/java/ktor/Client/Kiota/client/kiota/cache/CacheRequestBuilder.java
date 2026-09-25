package client.kiota.cache;

import client.kiota.cache.large.LargeRequestBuilder;
import client.kiota.cache.medium.MediumRequestBuilder;
import client.kiota.cache.small.SmallRequestBuilder;
import client.kiota.cache.vary.VaryRequestBuilder;
import com.microsoft.kiota.BaseRequestBuilder;
import com.microsoft.kiota.RequestAdapter;
import java.util.HashMap;
import java.util.Objects;
/**
 * Builds and executes requests for operations under /cache
 */
@jakarta.annotation.Generated("com.microsoft.kiota")
public class CacheRequestBuilder extends BaseRequestBuilder {
    /**
     * The large property
     * @return a {@link LargeRequestBuilder}
     */
    @jakarta.annotation.Nonnull
    public LargeRequestBuilder large() {
        return new LargeRequestBuilder(pathParameters, requestAdapter);
    }
    /**
     * The medium property
     * @return a {@link MediumRequestBuilder}
     */
    @jakarta.annotation.Nonnull
    public MediumRequestBuilder medium() {
        return new MediumRequestBuilder(pathParameters, requestAdapter);
    }
    /**
     * The small property
     * @return a {@link SmallRequestBuilder}
     */
    @jakarta.annotation.Nonnull
    public SmallRequestBuilder small() {
        return new SmallRequestBuilder(pathParameters, requestAdapter);
    }
    /**
     * The vary property
     * @return a {@link VaryRequestBuilder}
     */
    @jakarta.annotation.Nonnull
    public VaryRequestBuilder vary() {
        return new VaryRequestBuilder(pathParameters, requestAdapter);
    }
    /**
     * Instantiates a new {@link CacheRequestBuilder} and sets the default values.
     * @param pathParameters Path parameters for the request
     * @param requestAdapter The request adapter to use to execute the requests.
     */
    public CacheRequestBuilder(@jakarta.annotation.Nonnull final HashMap<String, Object> pathParameters, @jakarta.annotation.Nonnull final RequestAdapter requestAdapter) {
        super(requestAdapter, "{+baseurl}/cache", pathParameters);
    }
    /**
     * Instantiates a new {@link CacheRequestBuilder} and sets the default values.
     * @param rawUrl The raw URL to use for the request builder.
     * @param requestAdapter The request adapter to use to execute the requests.
     */
    public CacheRequestBuilder(@jakarta.annotation.Nonnull final String rawUrl, @jakarta.annotation.Nonnull final RequestAdapter requestAdapter) {
        super(requestAdapter, "{+baseurl}/cache", rawUrl);
    }
}
