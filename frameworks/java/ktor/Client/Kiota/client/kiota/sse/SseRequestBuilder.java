package client.kiota.sse;

import client.kiota.sse.medium.MediumRequestBuilder;
import com.microsoft.kiota.BaseRequestBuilder;
import com.microsoft.kiota.RequestAdapter;
import java.util.HashMap;
import java.util.Objects;
/**
 * Builds and executes requests for operations under /sse
 */
@jakarta.annotation.Generated("com.microsoft.kiota")
public class SseRequestBuilder extends BaseRequestBuilder {
    /**
     * The medium property
     * @return a {@link MediumRequestBuilder}
     */
    @jakarta.annotation.Nonnull
    public MediumRequestBuilder medium() {
        return new MediumRequestBuilder(pathParameters, requestAdapter);
    }
    /**
     * Instantiates a new {@link SseRequestBuilder} and sets the default values.
     * @param pathParameters Path parameters for the request
     * @param requestAdapter The request adapter to use to execute the requests.
     */
    public SseRequestBuilder(@jakarta.annotation.Nonnull final HashMap<String, Object> pathParameters, @jakarta.annotation.Nonnull final RequestAdapter requestAdapter) {
        super(requestAdapter, "{+baseurl}/sse", pathParameters);
    }
    /**
     * Instantiates a new {@link SseRequestBuilder} and sets the default values.
     * @param rawUrl The raw URL to use for the request builder.
     * @param requestAdapter The request adapter to use to execute the requests.
     */
    public SseRequestBuilder(@jakarta.annotation.Nonnull final String rawUrl, @jakarta.annotation.Nonnull final RequestAdapter requestAdapter) {
        super(requestAdapter, "{+baseurl}/sse", rawUrl);
    }
}
