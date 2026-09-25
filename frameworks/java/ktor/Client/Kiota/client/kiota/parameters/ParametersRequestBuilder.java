package client.kiota.parameters;

import client.kiota.parameters.item.WithOneItemRequestBuilder;
import client.kiota.parameters.staticescaped.StaticRequestBuilder;
import com.microsoft.kiota.BaseRequestBuilder;
import com.microsoft.kiota.RequestAdapter;
import java.util.HashMap;
import java.util.Objects;
/**
 * Builds and executes requests for operations under /parameters
 */
@jakarta.annotation.Generated("com.microsoft.kiota")
public class ParametersRequestBuilder extends BaseRequestBuilder {
    /**
     * The static property
     * @return a {@link StaticRequestBuilder}
     */
    @jakarta.annotation.Nonnull
    public StaticRequestBuilder staticEscaped() {
        return new StaticRequestBuilder(pathParameters, requestAdapter);
    }
    /**
     * Gets an item from the client.kiota.parameters.item collection
     * @param one Unique identifier of the item
     * @return a {@link WithOneItemRequestBuilder}
     */
    @jakarta.annotation.Nonnull
    public WithOneItemRequestBuilder byOne(@jakarta.annotation.Nonnull final String one) {
        Objects.requireNonNull(one);
        final HashMap<String, Object> urlTplParams = new HashMap<String, Object>(this.pathParameters);
        urlTplParams.put("one", one);
        return new WithOneItemRequestBuilder(urlTplParams, requestAdapter);
    }
    /**
     * Instantiates a new {@link ParametersRequestBuilder} and sets the default values.
     * @param pathParameters Path parameters for the request
     * @param requestAdapter The request adapter to use to execute the requests.
     */
    public ParametersRequestBuilder(@jakarta.annotation.Nonnull final HashMap<String, Object> pathParameters, @jakarta.annotation.Nonnull final RequestAdapter requestAdapter) {
        super(requestAdapter, "{+baseurl}/parameters", pathParameters);
    }
    /**
     * Instantiates a new {@link ParametersRequestBuilder} and sets the default values.
     * @param rawUrl The raw URL to use for the request builder.
     * @param requestAdapter The request adapter to use to execute the requests.
     */
    public ParametersRequestBuilder(@jakarta.annotation.Nonnull final String rawUrl, @jakarta.annotation.Nonnull final RequestAdapter requestAdapter) {
        super(requestAdapter, "{+baseurl}/parameters", rawUrl);
    }
}
