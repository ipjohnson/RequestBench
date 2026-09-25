package client.kiota.etag;

import client.kiota.etag.large.LargeRequestBuilder;
import client.kiota.etag.small.SmallRequestBuilder;
import com.microsoft.kiota.BaseRequestBuilder;
import com.microsoft.kiota.RequestAdapter;
import java.util.HashMap;
import java.util.Objects;
/**
 * Builds and executes requests for operations under /etag
 */
@jakarta.annotation.Generated("com.microsoft.kiota")
public class EtagRequestBuilder extends BaseRequestBuilder {
    /**
     * The large property
     * @return a {@link LargeRequestBuilder}
     */
    @jakarta.annotation.Nonnull
    public LargeRequestBuilder large() {
        return new LargeRequestBuilder(pathParameters, requestAdapter);
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
     * Instantiates a new {@link EtagRequestBuilder} and sets the default values.
     * @param pathParameters Path parameters for the request
     * @param requestAdapter The request adapter to use to execute the requests.
     */
    public EtagRequestBuilder(@jakarta.annotation.Nonnull final HashMap<String, Object> pathParameters, @jakarta.annotation.Nonnull final RequestAdapter requestAdapter) {
        super(requestAdapter, "{+baseurl}/etag", pathParameters);
    }
    /**
     * Instantiates a new {@link EtagRequestBuilder} and sets the default values.
     * @param rawUrl The raw URL to use for the request builder.
     * @param requestAdapter The request adapter to use to execute the requests.
     */
    public EtagRequestBuilder(@jakarta.annotation.Nonnull final String rawUrl, @jakarta.annotation.Nonnull final RequestAdapter requestAdapter) {
        super(requestAdapter, "{+baseurl}/etag", rawUrl);
    }
}
