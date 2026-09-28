package client.kiota.parameters.item.item;

import client.kiota.parameters.item.item.item.WithThreeItemRequestBuilder;
import com.microsoft.kiota.BaseRequestBuilder;
import com.microsoft.kiota.RequestAdapter;
import java.util.HashMap;
import java.util.Objects;
/**
 * Builds and executes requests for operations under /parameters/{one}/{two}
 */
@jakarta.annotation.Generated("com.microsoft.kiota")
public class WithTwoItemRequestBuilder extends BaseRequestBuilder {
    /**
     * Gets an item from the client.kiota.parameters.item.item.item collection
     * @param three Unique identifier of the item
     * @return a {@link WithThreeItemRequestBuilder}
     */
    @jakarta.annotation.Nonnull
    public WithThreeItemRequestBuilder byThree(@jakarta.annotation.Nonnull final String three) {
        Objects.requireNonNull(three);
        final HashMap<String, Object> urlTplParams = new HashMap<String, Object>(this.pathParameters);
        urlTplParams.put("three", three);
        return new WithThreeItemRequestBuilder(urlTplParams, requestAdapter);
    }
    /**
     * Instantiates a new {@link WithTwoItemRequestBuilder} and sets the default values.
     * @param pathParameters Path parameters for the request
     * @param requestAdapter The request adapter to use to execute the requests.
     */
    public WithTwoItemRequestBuilder(@jakarta.annotation.Nonnull final HashMap<String, Object> pathParameters, @jakarta.annotation.Nonnull final RequestAdapter requestAdapter) {
        super(requestAdapter, "{+baseurl}/parameters/{one}/{two}", pathParameters);
    }
    /**
     * Instantiates a new {@link WithTwoItemRequestBuilder} and sets the default values.
     * @param rawUrl The raw URL to use for the request builder.
     * @param requestAdapter The request adapter to use to execute the requests.
     */
    public WithTwoItemRequestBuilder(@jakarta.annotation.Nonnull final String rawUrl, @jakarta.annotation.Nonnull final RequestAdapter requestAdapter) {
        super(requestAdapter, "{+baseurl}/parameters/{one}/{two}", rawUrl);
    }
}
