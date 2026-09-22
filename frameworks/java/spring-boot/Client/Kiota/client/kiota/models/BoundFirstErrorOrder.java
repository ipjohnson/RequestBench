package client.kiota.models;

import com.microsoft.kiota.serialization.AdditionalDataHolder;
import com.microsoft.kiota.serialization.Parsable;
import com.microsoft.kiota.serialization.ParseNode;
import com.microsoft.kiota.serialization.SerializationWriter;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
@jakarta.annotation.Generated("com.microsoft.kiota")
public class BoundFirstErrorOrder implements AdditionalDataHolder, Parsable {
    /**
     * Stores additional data not described in the OpenAPI description found when deserializing. Can be used for serialization as well.
     */
    private Map<String, Object> additionalData;
    /**
     * The bytes property
     */
    private Long bytes;
    /**
     * The echo property
     */
    private FirstErrorOrder echo;
    /**
     * The fields property
     */
    private Integer fields;
    /**
     * Instantiates a new {@link BoundFirstErrorOrder} and sets the default values.
     */
    public BoundFirstErrorOrder() {
        this.setAdditionalData(new HashMap<>());
    }
    /**
     * Creates a new instance of the appropriate class based on discriminator value
     * @param parseNode The parse node to use to read the discriminator value and create the object
     * @return a {@link BoundFirstErrorOrder}
     */
    @jakarta.annotation.Nonnull
    public static BoundFirstErrorOrder createFromDiscriminatorValue(@jakarta.annotation.Nonnull final ParseNode parseNode) {
        Objects.requireNonNull(parseNode);
        return new BoundFirstErrorOrder();
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
     * Gets the bytes property value. The bytes property
     * @return a {@link Long}
     */
    @jakarta.annotation.Nullable
    public Long getBytes() {
        return this.bytes;
    }
    /**
     * Gets the echo property value. The echo property
     * @return a {@link FirstErrorOrder}
     */
    @jakarta.annotation.Nullable
    public FirstErrorOrder getEcho() {
        return this.echo;
    }
    /**
     * The deserialization information for the current model
     * @return a {@link Map<String, java.util.function.Consumer<ParseNode>>}
     */
    @jakarta.annotation.Nonnull
    public Map<String, java.util.function.Consumer<ParseNode>> getFieldDeserializers() {
        final HashMap<String, java.util.function.Consumer<ParseNode>> deserializerMap = new HashMap<String, java.util.function.Consumer<ParseNode>>(3);
        deserializerMap.put("bytes", (n) -> { this.setBytes(n.getLongValue()); });
        deserializerMap.put("echo", (n) -> { this.setEcho(n.getObjectValue(FirstErrorOrder::createFromDiscriminatorValue)); });
        deserializerMap.put("fields", (n) -> { this.setFields(n.getIntegerValue()); });
        return deserializerMap;
    }
    /**
     * Gets the fields property value. The fields property
     * @return a {@link Integer}
     */
    @jakarta.annotation.Nullable
    public Integer getFields() {
        return this.fields;
    }
    /**
     * Serializes information the current object
     * @param writer Serialization writer to use to serialize this model
     */
    public void serialize(@jakarta.annotation.Nonnull final SerializationWriter writer) {
        Objects.requireNonNull(writer);
        writer.writeLongValue("bytes", this.getBytes());
        writer.writeObjectValue("echo", this.getEcho());
        writer.writeIntegerValue("fields", this.getFields());
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
     * Sets the bytes property value. The bytes property
     * @param value Value to set for the bytes property.
     */
    public void setBytes(@jakarta.annotation.Nullable final Long value) {
        this.bytes = value;
    }
    /**
     * Sets the echo property value. The echo property
     * @param value Value to set for the echo property.
     */
    public void setEcho(@jakarta.annotation.Nullable final FirstErrorOrder value) {
        this.echo = value;
    }
    /**
     * Sets the fields property value. The fields property
     * @param value Value to set for the fields property.
     */
    public void setFields(@jakarta.annotation.Nullable final Integer value) {
        this.fields = value;
    }
}
