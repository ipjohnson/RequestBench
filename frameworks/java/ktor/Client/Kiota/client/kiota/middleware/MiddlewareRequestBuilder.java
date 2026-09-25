package client.kiota.middleware;

import client.kiota.middleware.four.FourRequestBuilder;
import client.kiota.middleware.none.NoneRequestBuilder;
import client.kiota.middleware.sixteen.SixteenRequestBuilder;
import com.microsoft.kiota.BaseRequestBuilder;
import com.microsoft.kiota.RequestAdapter;
import java.util.HashMap;
import java.util.Objects;
/**
 * Builds and executes requests for operations under /middleware
 */
@jakarta.annotation.Generated("com.microsoft.kiota")
public class MiddlewareRequestBuilder extends BaseRequestBuilder {
    /**
     * The four property
     * @return a {@link FourRequestBuilder}
     */
    @jakarta.annotation.Nonnull
    public FourRequestBuilder four() {
        return new FourRequestBuilder(pathParameters, requestAdapter);
    }
    /**
     * The none property
     * @return a {@link NoneRequestBuilder}
     */
    @jakarta.annotation.Nonnull
    public NoneRequestBuilder none() {
        return new NoneRequestBuilder(pathParameters, requestAdapter);
    }
    /**
     * The sixteen property
     * @return a {@link SixteenRequestBuilder}
     */
    @jakarta.annotation.Nonnull
    public SixteenRequestBuilder sixteen() {
        return new SixteenRequestBuilder(pathParameters, requestAdapter);
    }
    /**
     * Instantiates a new {@link MiddlewareRequestBuilder} and sets the default values.
     * @param pathParameters Path parameters for the request
     * @param requestAdapter The request adapter to use to execute the requests.
     */
    public MiddlewareRequestBuilder(@jakarta.annotation.Nonnull final HashMap<String, Object> pathParameters, @jakarta.annotation.Nonnull final RequestAdapter requestAdapter) {
        super(requestAdapter, "{+baseurl}/middleware", pathParameters);
    }
    /**
     * Instantiates a new {@link MiddlewareRequestBuilder} and sets the default values.
     * @param rawUrl The raw URL to use for the request builder.
     * @param requestAdapter The request adapter to use to execute the requests.
     */
    public MiddlewareRequestBuilder(@jakarta.annotation.Nonnull final String rawUrl, @jakarta.annotation.Nonnull final RequestAdapter requestAdapter) {
        super(requestAdapter, "{+baseurl}/middleware", rawUrl);
    }
}
