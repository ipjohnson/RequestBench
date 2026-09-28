package client.kiota.parameters.item;

import client.kiota.parameters.item.item.WithTwoItemRequestBuilder;
import client.kiota.parameters.item.segment.SegmentRequestBuilder;
import client.kiota.parameters.item.withsecond.WithSecondRequestBuilder;
import com.microsoft.kiota.BaseRequestBuilder;
import com.microsoft.kiota.RequestAdapter;
import java.util.HashMap;
import java.util.Objects;
/**
 * Builds and executes requests for operations under /parameters/{one}
 */
@jakarta.annotation.Generated("com.microsoft.kiota")
public class WithOneItemRequestBuilder extends BaseRequestBuilder {
    /**
     * The segment property
     * @return a {@link SegmentRequestBuilder}
     */
    @jakarta.annotation.Nonnull
    public SegmentRequestBuilder segment() {
        return new SegmentRequestBuilder(pathParameters, requestAdapter);
    }
    /**
     * The withSecond property
     * @return a {@link WithSecondRequestBuilder}
     */
    @jakarta.annotation.Nonnull
    public WithSecondRequestBuilder withSecond() {
        return new WithSecondRequestBuilder(pathParameters, requestAdapter);
    }
    /**
     * Gets an item from the client.kiota.parameters.item.item collection
     * @param two Unique identifier of the item
     * @return a {@link WithTwoItemRequestBuilder}
     */
    @jakarta.annotation.Nonnull
    public WithTwoItemRequestBuilder byTwo(@jakarta.annotation.Nonnull final String two) {
        Objects.requireNonNull(two);
        final HashMap<String, Object> urlTplParams = new HashMap<String, Object>(this.pathParameters);
        urlTplParams.put("two", two);
        return new WithTwoItemRequestBuilder(urlTplParams, requestAdapter);
    }
    /**
     * Instantiates a new {@link WithOneItemRequestBuilder} and sets the default values.
     * @param pathParameters Path parameters for the request
     * @param requestAdapter The request adapter to use to execute the requests.
     */
    public WithOneItemRequestBuilder(@jakarta.annotation.Nonnull final HashMap<String, Object> pathParameters, @jakarta.annotation.Nonnull final RequestAdapter requestAdapter) {
        super(requestAdapter, "{+baseurl}/parameters/{one}", pathParameters);
    }
    /**
     * Instantiates a new {@link WithOneItemRequestBuilder} and sets the default values.
     * @param rawUrl The raw URL to use for the request builder.
     * @param requestAdapter The request adapter to use to execute the requests.
     */
    public WithOneItemRequestBuilder(@jakarta.annotation.Nonnull final String rawUrl, @jakarta.annotation.Nonnull final RequestAdapter requestAdapter) {
        super(requestAdapter, "{+baseurl}/parameters/{one}", rawUrl);
    }
}
