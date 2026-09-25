package client.kiota.cache.vary;

import client.kiota.cache.vary.many.ManyRequestBuilder;
import client.kiota.cache.vary.one.OneRequestBuilder;
import com.microsoft.kiota.BaseRequestBuilder;
import com.microsoft.kiota.RequestAdapter;
import java.util.HashMap;
import java.util.Objects;
/**
 * Builds and executes requests for operations under /cache/vary
 */
@jakarta.annotation.Generated("com.microsoft.kiota")
public class VaryRequestBuilder extends BaseRequestBuilder {
    /**
     * The many property
     * @return a {@link ManyRequestBuilder}
     */
    @jakarta.annotation.Nonnull
    public ManyRequestBuilder many() {
        return new ManyRequestBuilder(pathParameters, requestAdapter);
    }
    /**
     * The one property
     * @return a {@link OneRequestBuilder}
     */
    @jakarta.annotation.Nonnull
    public OneRequestBuilder one() {
        return new OneRequestBuilder(pathParameters, requestAdapter);
    }
    /**
     * Instantiates a new {@link VaryRequestBuilder} and sets the default values.
     * @param pathParameters Path parameters for the request
     * @param requestAdapter The request adapter to use to execute the requests.
     */
    public VaryRequestBuilder(@jakarta.annotation.Nonnull final HashMap<String, Object> pathParameters, @jakarta.annotation.Nonnull final RequestAdapter requestAdapter) {
        super(requestAdapter, "{+baseurl}/cache/vary", pathParameters);
    }
    /**
     * Instantiates a new {@link VaryRequestBuilder} and sets the default values.
     * @param rawUrl The raw URL to use for the request builder.
     * @param requestAdapter The request adapter to use to execute the requests.
     */
    public VaryRequestBuilder(@jakarta.annotation.Nonnull final String rawUrl, @jakarta.annotation.Nonnull final RequestAdapter requestAdapter) {
        super(requestAdapter, "{+baseurl}/cache/vary", rawUrl);
    }
}
