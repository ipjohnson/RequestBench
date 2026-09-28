package client.kiota.cache.medium;

import client.kiota.cache.medium.item.WithKeyItemRequestBuilder;
import com.microsoft.kiota.BaseRequestBuilder;
import com.microsoft.kiota.RequestAdapter;
import java.util.HashMap;
import java.util.Objects;
/**
 * Builds and executes requests for operations under /cache/medium
 */
@jakarta.annotation.Generated("com.microsoft.kiota")
public class MediumRequestBuilder extends BaseRequestBuilder {
    /**
     * Gets an item from the client.kiota.cache.medium.item collection
     * @param key Unique identifier of the item
     * @return a {@link WithKeyItemRequestBuilder}
     */
    @jakarta.annotation.Nonnull
    public WithKeyItemRequestBuilder byKey(@jakarta.annotation.Nonnull final String key) {
        Objects.requireNonNull(key);
        final HashMap<String, Object> urlTplParams = new HashMap<String, Object>(this.pathParameters);
        urlTplParams.put("key", key);
        return new WithKeyItemRequestBuilder(urlTplParams, requestAdapter);
    }
    /**
     * Instantiates a new {@link MediumRequestBuilder} and sets the default values.
     * @param pathParameters Path parameters for the request
     * @param requestAdapter The request adapter to use to execute the requests.
     */
    public MediumRequestBuilder(@jakarta.annotation.Nonnull final HashMap<String, Object> pathParameters, @jakarta.annotation.Nonnull final RequestAdapter requestAdapter) {
        super(requestAdapter, "{+baseurl}/cache/medium", pathParameters);
    }
    /**
     * Instantiates a new {@link MediumRequestBuilder} and sets the default values.
     * @param rawUrl The raw URL to use for the request builder.
     * @param requestAdapter The request adapter to use to execute the requests.
     */
    public MediumRequestBuilder(@jakarta.annotation.Nonnull final String rawUrl, @jakarta.annotation.Nonnull final RequestAdapter requestAdapter) {
        super(requestAdapter, "{+baseurl}/cache/medium", rawUrl);
    }
}
