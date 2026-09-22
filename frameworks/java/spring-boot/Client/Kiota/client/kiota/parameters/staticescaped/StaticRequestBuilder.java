package client.kiota.parameters.staticescaped;

import client.kiota.parameters.staticescaped.segment.SegmentRequestBuilder;
import com.microsoft.kiota.BaseRequestBuilder;
import com.microsoft.kiota.RequestAdapter;
import java.util.HashMap;
import java.util.Objects;
/**
 * Builds and executes requests for operations under /parameters/static
 */
@jakarta.annotation.Generated("com.microsoft.kiota")
public class StaticRequestBuilder extends BaseRequestBuilder {
    /**
     * The segment property
     * @return a {@link SegmentRequestBuilder}
     */
    @jakarta.annotation.Nonnull
    public SegmentRequestBuilder segment() {
        return new SegmentRequestBuilder(pathParameters, requestAdapter);
    }
    /**
     * Instantiates a new {@link StaticRequestBuilder} and sets the default values.
     * @param pathParameters Path parameters for the request
     * @param requestAdapter The request adapter to use to execute the requests.
     */
    public StaticRequestBuilder(@jakarta.annotation.Nonnull final HashMap<String, Object> pathParameters, @jakarta.annotation.Nonnull final RequestAdapter requestAdapter) {
        super(requestAdapter, "{+baseurl}/parameters/static", pathParameters);
    }
    /**
     * Instantiates a new {@link StaticRequestBuilder} and sets the default values.
     * @param rawUrl The raw URL to use for the request builder.
     * @param requestAdapter The request adapter to use to execute the requests.
     */
    public StaticRequestBuilder(@jakarta.annotation.Nonnull final String rawUrl, @jakarta.annotation.Nonnull final RequestAdapter requestAdapter) {
        super(requestAdapter, "{+baseurl}/parameters/static", rawUrl);
    }
}
