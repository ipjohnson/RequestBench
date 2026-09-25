package client.kiota.jsonescaped;

import client.kiota.jsonescaped.large.LargeRequestBuilder;
import client.kiota.jsonescaped.medium.MediumRequestBuilder;
import client.kiota.jsonescaped.small.SmallRequestBuilder;
import com.microsoft.kiota.BaseRequestBuilder;
import com.microsoft.kiota.RequestAdapter;
import java.util.HashMap;
import java.util.Objects;
/**
 * Builds and executes requests for operations under /json
 */
@jakarta.annotation.Generated("com.microsoft.kiota")
public class JsonRequestBuilder extends BaseRequestBuilder {
    /**
     * The large property
     * @return a {@link LargeRequestBuilder}
     */
    @jakarta.annotation.Nonnull
    public LargeRequestBuilder large() {
        return new LargeRequestBuilder(pathParameters, requestAdapter);
    }
    /**
     * The medium property
     * @return a {@link MediumRequestBuilder}
     */
    @jakarta.annotation.Nonnull
    public MediumRequestBuilder medium() {
        return new MediumRequestBuilder(pathParameters, requestAdapter);
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
     * Instantiates a new {@link JsonRequestBuilder} and sets the default values.
     * @param pathParameters Path parameters for the request
     * @param requestAdapter The request adapter to use to execute the requests.
     */
    public JsonRequestBuilder(@jakarta.annotation.Nonnull final HashMap<String, Object> pathParameters, @jakarta.annotation.Nonnull final RequestAdapter requestAdapter) {
        super(requestAdapter, "{+baseurl}/json", pathParameters);
    }
    /**
     * Instantiates a new {@link JsonRequestBuilder} and sets the default values.
     * @param rawUrl The raw URL to use for the request builder.
     * @param requestAdapter The request adapter to use to execute the requests.
     */
    public JsonRequestBuilder(@jakarta.annotation.Nonnull final String rawUrl, @jakarta.annotation.Nonnull final RequestAdapter requestAdapter) {
        super(requestAdapter, "{+baseurl}/json", rawUrl);
    }
}
