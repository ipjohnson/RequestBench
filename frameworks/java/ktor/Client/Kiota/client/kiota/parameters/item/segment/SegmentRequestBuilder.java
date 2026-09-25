package client.kiota.parameters.item.segment;

import client.kiota.parameters.item.segment.literal.LiteralRequestBuilder;
import com.microsoft.kiota.BaseRequestBuilder;
import com.microsoft.kiota.RequestAdapter;
import java.util.HashMap;
import java.util.Objects;
/**
 * Builds and executes requests for operations under /parameters/{one}/segment
 */
@jakarta.annotation.Generated("com.microsoft.kiota")
public class SegmentRequestBuilder extends BaseRequestBuilder {
    /**
     * The literal property
     * @return a {@link LiteralRequestBuilder}
     */
    @jakarta.annotation.Nonnull
    public LiteralRequestBuilder literal() {
        return new LiteralRequestBuilder(pathParameters, requestAdapter);
    }
    /**
     * Instantiates a new {@link SegmentRequestBuilder} and sets the default values.
     * @param pathParameters Path parameters for the request
     * @param requestAdapter The request adapter to use to execute the requests.
     */
    public SegmentRequestBuilder(@jakarta.annotation.Nonnull final HashMap<String, Object> pathParameters, @jakarta.annotation.Nonnull final RequestAdapter requestAdapter) {
        super(requestAdapter, "{+baseurl}/parameters/{one}/segment", pathParameters);
    }
    /**
     * Instantiates a new {@link SegmentRequestBuilder} and sets the default values.
     * @param rawUrl The raw URL to use for the request builder.
     * @param requestAdapter The request adapter to use to execute the requests.
     */
    public SegmentRequestBuilder(@jakarta.annotation.Nonnull final String rawUrl, @jakarta.annotation.Nonnull final RequestAdapter requestAdapter) {
        super(requestAdapter, "{+baseurl}/parameters/{one}/segment", rawUrl);
    }
}
