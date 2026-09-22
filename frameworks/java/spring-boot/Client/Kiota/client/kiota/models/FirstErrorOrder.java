package client.kiota.models;

import com.microsoft.kiota.serialization.AdditionalDataHolder;
import com.microsoft.kiota.serialization.Parsable;
import com.microsoft.kiota.serialization.ParseNode;
import com.microsoft.kiota.serialization.SerializationWriter;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
@jakarta.annotation.Generated("com.microsoft.kiota")
public class FirstErrorOrder implements AdditionalDataHolder, Parsable {
    /**
     * Stores additional data not described in the OpenAPI description found when deserializing. Can be used for serialization as well.
     */
    private Map<String, Object> additionalData;
    /**
     * The customerId property
     */
    private Integer customerId;
    /**
     * The lines property
     */
    private java.util.List<Line> lines;
    /**
     * The status property
     */
    private String status;
    /**
     * Instantiates a new {@link FirstErrorOrder} and sets the default values.
     */
    public FirstErrorOrder() {
        this.setAdditionalData(new HashMap<>());
    }
    /**
     * Creates a new instance of the appropriate class based on discriminator value
     * @param parseNode The parse node to use to read the discriminator value and create the object
     * @return a {@link FirstErrorOrder}
     */
    @jakarta.annotation.Nonnull
    public static FirstErrorOrder createFromDiscriminatorValue(@jakarta.annotation.Nonnull final ParseNode parseNode) {
        Objects.requireNonNull(parseNode);
        return new FirstErrorOrder();
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
     * Gets the customerId property value. The customerId property
     * @return a {@link Integer}
     */
    @jakarta.annotation.Nullable
    public Integer getCustomerId() {
        return this.customerId;
    }
    /**
     * The deserialization information for the current model
     * @return a {@link Map<String, java.util.function.Consumer<ParseNode>>}
     */
    @jakarta.annotation.Nonnull
    public Map<String, java.util.function.Consumer<ParseNode>> getFieldDeserializers() {
        final HashMap<String, java.util.function.Consumer<ParseNode>> deserializerMap = new HashMap<String, java.util.function.Consumer<ParseNode>>(3);
        deserializerMap.put("customerId", (n) -> { this.setCustomerId(n.getIntegerValue()); });
        deserializerMap.put("lines", (n) -> { this.setLines(n.getCollectionOfObjectValues(Line::createFromDiscriminatorValue)); });
        deserializerMap.put("status", (n) -> { this.setStatus(n.getStringValue()); });
        return deserializerMap;
    }
    /**
     * Gets the lines property value. The lines property
     * @return a {@link java.util.List<Line>}
     */
    @jakarta.annotation.Nullable
    public java.util.List<Line> getLines() {
        return this.lines;
    }
    /**
     * Gets the status property value. The status property
     * @return a {@link String}
     */
    @jakarta.annotation.Nullable
    public String getStatus() {
        return this.status;
    }
    /**
     * Serializes information the current object
     * @param writer Serialization writer to use to serialize this model
     */
    public void serialize(@jakarta.annotation.Nonnull final SerializationWriter writer) {
        Objects.requireNonNull(writer);
        writer.writeIntegerValue("customerId", this.getCustomerId());
        writer.writeCollectionOfObjectValues("lines", this.getLines());
        writer.writeStringValue("status", this.getStatus());
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
     * Sets the customerId property value. The customerId property
     * @param value Value to set for the customerId property.
     */
    public void setCustomerId(@jakarta.annotation.Nullable final Integer value) {
        this.customerId = value;
    }
    /**
     * Sets the lines property value. The lines property
     * @param value Value to set for the lines property.
     */
    public void setLines(@jakarta.annotation.Nullable final java.util.List<Line> value) {
        this.lines = value;
    }
    /**
     * Sets the status property value. The status property
     * @param value Value to set for the status property.
     */
    public void setStatus(@jakarta.annotation.Nullable final String value) {
        this.status = value;
    }
}
