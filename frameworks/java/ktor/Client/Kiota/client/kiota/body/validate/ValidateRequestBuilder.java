package client.kiota.body.validate;

import client.kiota.body.validate.firsterror.FirstErrorRequestBuilder;
import client.kiota.body.validate.medium.MediumRequestBuilder;
import client.kiota.body.validate.small.SmallRequestBuilder;
import com.microsoft.kiota.BaseRequestBuilder;
import com.microsoft.kiota.RequestAdapter;
import java.util.HashMap;
import java.util.Objects;
/**
 * Builds and executes requests for operations under /body/validate
 */
@jakarta.annotation.Generated("com.microsoft.kiota")
public class ValidateRequestBuilder extends BaseRequestBuilder {
    /**
     * The firstError property
     * @return a {@link FirstErrorRequestBuilder}
     */
    @jakarta.annotation.Nonnull
    public FirstErrorRequestBuilder firstError() {
        return new FirstErrorRequestBuilder(pathParameters, requestAdapter);
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
     * Instantiates a new {@link ValidateRequestBuilder} and sets the default values.
     * @param pathParameters Path parameters for the request
     * @param requestAdapter The request adapter to use to execute the requests.
     */
    public ValidateRequestBuilder(@jakarta.annotation.Nonnull final HashMap<String, Object> pathParameters, @jakarta.annotation.Nonnull final RequestAdapter requestAdapter) {
        super(requestAdapter, "{+baseurl}/body/validate", pathParameters);
    }
    /**
     * Instantiates a new {@link ValidateRequestBuilder} and sets the default values.
     * @param rawUrl The raw URL to use for the request builder.
     * @param requestAdapter The request adapter to use to execute the requests.
     */
    public ValidateRequestBuilder(@jakarta.annotation.Nonnull final String rawUrl, @jakarta.annotation.Nonnull final RequestAdapter requestAdapter) {
        super(requestAdapter, "{+baseurl}/body/validate", rawUrl);
    }
}
