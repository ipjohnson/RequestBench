package client.kiota.parameters.item.withsecond;

import client.kiota.parameters.item.withsecond.item.WithTwoItemRequestBuilder;
import com.microsoft.kiota.BaseRequestBuilder;
import com.microsoft.kiota.RequestAdapter;
import java.util.HashMap;
import java.util.Objects;
/**
 * Builds and executes requests for operations under /parameters/{one}/with-second
 */
@jakarta.annotation.Generated("com.microsoft.kiota")
public class WithSecondRequestBuilder extends BaseRequestBuilder {
    /**
     * Gets an item from the client.kiota.parameters.item.withSecond.item collection
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
     * Instantiates a new {@link WithSecondRequestBuilder} and sets the default values.
     * @param pathParameters Path parameters for the request
     * @param requestAdapter The request adapter to use to execute the requests.
     */
    public WithSecondRequestBuilder(@jakarta.annotation.Nonnull final HashMap<String, Object> pathParameters, @jakarta.annotation.Nonnull final RequestAdapter requestAdapter) {
        super(requestAdapter, "{+baseurl}/parameters/{one}/with-second", pathParameters);
    }
    /**
     * Instantiates a new {@link WithSecondRequestBuilder} and sets the default values.
     * @param rawUrl The raw URL to use for the request builder.
     * @param requestAdapter The request adapter to use to execute the requests.
     */
    public WithSecondRequestBuilder(@jakarta.annotation.Nonnull final String rawUrl, @jakarta.annotation.Nonnull final RequestAdapter requestAdapter) {
        super(requestAdapter, "{+baseurl}/parameters/{one}/with-second", rawUrl);
    }
}
