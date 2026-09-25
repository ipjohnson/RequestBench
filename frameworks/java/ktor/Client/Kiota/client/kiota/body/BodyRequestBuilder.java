package client.kiota.body;

import client.kiota.body.bind.BindRequestBuilder;
import client.kiota.body.validate.ValidateRequestBuilder;
import com.microsoft.kiota.BaseRequestBuilder;
import com.microsoft.kiota.RequestAdapter;
import java.util.HashMap;
import java.util.Objects;
/**
 * Builds and executes requests for operations under /body
 */
@jakarta.annotation.Generated("com.microsoft.kiota")
public class BodyRequestBuilder extends BaseRequestBuilder {
    /**
     * The bind property
     * @return a {@link BindRequestBuilder}
     */
    @jakarta.annotation.Nonnull
    public BindRequestBuilder bind() {
        return new BindRequestBuilder(pathParameters, requestAdapter);
    }
    /**
     * The validate property
     * @return a {@link ValidateRequestBuilder}
     */
    @jakarta.annotation.Nonnull
    public ValidateRequestBuilder validate() {
        return new ValidateRequestBuilder(pathParameters, requestAdapter);
    }
    /**
     * Instantiates a new {@link BodyRequestBuilder} and sets the default values.
     * @param pathParameters Path parameters for the request
     * @param requestAdapter The request adapter to use to execute the requests.
     */
    public BodyRequestBuilder(@jakarta.annotation.Nonnull final HashMap<String, Object> pathParameters, @jakarta.annotation.Nonnull final RequestAdapter requestAdapter) {
        super(requestAdapter, "{+baseurl}/body", pathParameters);
    }
    /**
     * Instantiates a new {@link BodyRequestBuilder} and sets the default values.
     * @param rawUrl The raw URL to use for the request builder.
     * @param requestAdapter The request adapter to use to execute the requests.
     */
    public BodyRequestBuilder(@jakarta.annotation.Nonnull final String rawUrl, @jakarta.annotation.Nonnull final RequestAdapter requestAdapter) {
        super(requestAdapter, "{+baseurl}/body", rawUrl);
    }
}
