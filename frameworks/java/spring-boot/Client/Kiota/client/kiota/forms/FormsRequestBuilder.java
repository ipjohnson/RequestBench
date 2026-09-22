package client.kiota.forms;

import client.kiota.forms.multipart.MultipartRequestBuilder;
import client.kiota.forms.urlencoded.UrlencodedRequestBuilder;
import com.microsoft.kiota.BaseRequestBuilder;
import com.microsoft.kiota.RequestAdapter;
import java.util.HashMap;
import java.util.Objects;
/**
 * Builds and executes requests for operations under /forms
 */
@jakarta.annotation.Generated("com.microsoft.kiota")
public class FormsRequestBuilder extends BaseRequestBuilder {
    /**
     * The multipart property
     * @return a {@link MultipartRequestBuilder}
     */
    @jakarta.annotation.Nonnull
    public MultipartRequestBuilder multipart() {
        return new MultipartRequestBuilder(pathParameters, requestAdapter);
    }
    /**
     * The urlencoded property
     * @return a {@link UrlencodedRequestBuilder}
     */
    @jakarta.annotation.Nonnull
    public UrlencodedRequestBuilder urlencoded() {
        return new UrlencodedRequestBuilder(pathParameters, requestAdapter);
    }
    /**
     * Instantiates a new {@link FormsRequestBuilder} and sets the default values.
     * @param pathParameters Path parameters for the request
     * @param requestAdapter The request adapter to use to execute the requests.
     */
    public FormsRequestBuilder(@jakarta.annotation.Nonnull final HashMap<String, Object> pathParameters, @jakarta.annotation.Nonnull final RequestAdapter requestAdapter) {
        super(requestAdapter, "{+baseurl}/forms", pathParameters);
    }
    /**
     * Instantiates a new {@link FormsRequestBuilder} and sets the default values.
     * @param rawUrl The raw URL to use for the request builder.
     * @param requestAdapter The request adapter to use to execute the requests.
     */
    public FormsRequestBuilder(@jakarta.annotation.Nonnull final String rawUrl, @jakarta.annotation.Nonnull final RequestAdapter requestAdapter) {
        super(requestAdapter, "{+baseurl}/forms", rawUrl);
    }
}
