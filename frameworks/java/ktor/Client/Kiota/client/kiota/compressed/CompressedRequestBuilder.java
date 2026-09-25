package client.kiota.compressed;

import client.kiota.compressed.large.LargeRequestBuilder;
import client.kiota.compressed.small.SmallRequestBuilder;
import com.microsoft.kiota.BaseRequestBuilder;
import com.microsoft.kiota.RequestAdapter;
import java.util.HashMap;
import java.util.Objects;
/**
 * Builds and executes requests for operations under /compressed
 */
@jakarta.annotation.Generated("com.microsoft.kiota")
public class CompressedRequestBuilder extends BaseRequestBuilder {
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
     * Instantiates a new {@link CompressedRequestBuilder} and sets the default values.
     * @param pathParameters Path parameters for the request
     * @param requestAdapter The request adapter to use to execute the requests.
     */
    public CompressedRequestBuilder(@jakarta.annotation.Nonnull final HashMap<String, Object> pathParameters, @jakarta.annotation.Nonnull final RequestAdapter requestAdapter) {
        super(requestAdapter, "{+baseurl}/compressed", pathParameters);
    }
    /**
     * Instantiates a new {@link CompressedRequestBuilder} and sets the default values.
     * @param rawUrl The raw URL to use for the request builder.
     * @param requestAdapter The request adapter to use to execute the requests.
     */
    public CompressedRequestBuilder(@jakarta.annotation.Nonnull final String rawUrl, @jakarta.annotation.Nonnull final RequestAdapter requestAdapter) {
        super(requestAdapter, "{+baseurl}/compressed", rawUrl);
    }
}
