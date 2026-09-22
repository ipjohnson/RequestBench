package client.kiota.models;

import com.microsoft.kiota.serialization.AdditionalDataHolder;
import com.microsoft.kiota.serialization.Parsable;
import com.microsoft.kiota.serialization.ParseNode;
import com.microsoft.kiota.serialization.SerializationWriter;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
@jakarta.annotation.Generated("com.microsoft.kiota")
public class UploadEcho implements AdditionalDataHolder, Parsable {
    /**
     * Stores additional data not described in the OpenAPI description found when deserializing. Can be used for serialization as well.
     */
    private Map<String, Object> additionalData;
    /**
     * The requestId property
     */
    private String requestId;
    /**
     * The tenant property
     */
    private String tenant;
    /**
     * Instantiates a new {@link UploadEcho} and sets the default values.
     */
    public UploadEcho() {
        this.setAdditionalData(new HashMap<>());
    }
    /**
     * Creates a new instance of the appropriate class based on discriminator value
     * @param parseNode The parse node to use to read the discriminator value and create the object
     * @return a {@link UploadEcho}
     */
    @jakarta.annotation.Nonnull
    public static UploadEcho createFromDiscriminatorValue(@jakarta.annotation.Nonnull final ParseNode parseNode) {
        Objects.requireNonNull(parseNode);
        return new UploadEcho();
    }
    /**
     * Gets the AdditionalData property value. Stores additional data not described in the OpenAPI description found when deserializing. Can be used for serialization as well.
     * @return a {@link Map<String, Object>}
     */
    @jakarta.annotation.Nonnull
    public Map<String, Object> getAdditionalData() {
        return this.additionalData;
    }
    /**
     * The deserialization information for the current model
     * @return a {@link Map<String, java.util.function.Consumer<ParseNode>>}
     */
    @jakarta.annotation.Nonnull
    public Map<String, java.util.function.Consumer<ParseNode>> getFieldDeserializers() {
        final HashMap<String, java.util.function.Consumer<ParseNode>> deserializerMap = new HashMap<String, java.util.function.Consumer<ParseNode>>(2);
        deserializerMap.put("requestId", (n) -> { this.setRequestId(n.getStringValue()); });
        deserializerMap.put("tenant", (n) -> { this.setTenant(n.getStringValue()); });
        return deserializerMap;
    }
    /**
     * Gets the requestId property value. The requestId property
     * @return a {@link String}
     */
    @jakarta.annotation.Nullable
    public String getRequestId() {
        return this.requestId;
    }
    /**
     * Gets the tenant property value. The tenant property
     * @return a {@link String}
     */
    @jakarta.annotation.Nullable
    public String getTenant() {
        return this.tenant;
    }
    /**
     * Serializes information the current object
     * @param writer Serialization writer to use to serialize this model
     */
    public void serialize(@jakarta.annotation.Nonnull final SerializationWriter writer) {
        Objects.requireNonNull(writer);
        writer.writeStringValue("requestId", this.getRequestId());
        writer.writeStringValue("tenant", this.getTenant());
        writer.writeAdditionalData(this.getAdditionalData());
    }
    /**
     * Sets the AdditionalData property value. Stores additional data not described in the OpenAPI description found when deserializing. Can be used for serialization as well.
     * @param value Value to set for the AdditionalData property.
     */
    public void setAdditionalData(@jakarta.annotation.Nullable final Map<String, Object> value) {
        this.additionalData = value;
    }
    /**
     * Sets the requestId property value. The requestId property
     * @param value Value to set for the requestId property.
     */
    public void setRequestId(@jakarta.annotation.Nullable final String value) {
        this.requestId = value;
    }
    /**
     * Sets the tenant property value. The tenant property
     * @param value Value to set for the tenant property.
     */
    public void setTenant(@jakarta.annotation.Nullable final String value) {
        this.tenant = value;
    }
}
